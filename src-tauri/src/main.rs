// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use regex::Regex;

#[derive(Serialize, Deserialize)]
struct GitHubFileRequest {
    message: String,
    content: String,
    branch: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    sha: Option<String>,
}

#[derive(Deserialize)]
struct GitHubFileResponse {
    #[serde(default)]
    sha: String,
}

#[tauri::command]
fn clean_old_videos(days_old: u64) -> Result<String, String> {
    // 获取用户主目录
    let home_dir = dirs::home_dir().ok_or("无法获取用户主目录")?;
    let video_dir = home_dir.join(".screenpipe").join("data");
    
    if !video_dir.exists() {
        return Ok("视频目录不存在".to_string());
    }
    
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();
    
    let cutoff_time = now - (days_old * 24 * 60 * 60);
    
    let mut deleted_count = 0;
    let mut freed_space: u64 = 0;
    
    // 读取目录中的所有 .mp4 文件
    if let Ok(entries) = fs::read_dir(&video_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            
            // 只处理 .mp4 文件
            if path.extension().and_then(|s| s.to_str()) == Some("mp4") {
                if let Ok(metadata) = entry.metadata() {
                    if let Ok(modified) = metadata.modified() {
                        let modified_time = modified
                            .duration_since(UNIX_EPOCH)
                            .map_err(|e| e.to_string())?
                            .as_secs();
                        
                        // 如果文件修改时间早于截止时间，删除它
                        if modified_time < cutoff_time {
                            let file_size = metadata.len();
                            if fs::remove_file(&path).is_ok() {
                                deleted_count += 1;
                                freed_space += file_size;
                            }
                        }
                    }
                }
            }
        }
    }
    
    let freed_mb = freed_space as f64 / 1024.0 / 1024.0;
    Ok(format!(
        "已删除 {} 个视频文件，释放 {:.2} MB 空间",
        deleted_count, freed_mb
    ))
}

/// 清理 Markdown 内容，移除多余的代码块包裹
fn clean_markdown_content(content: &str) -> String {
    let mut cleaned = content.to_string();
    
    // 移除开头的 ```markdown 或 ```
    let re_start_markdown = Regex::new(r"^```markdown\s*\n").unwrap();
    let re_start = Regex::new(r"^```\s*\n").unwrap();
    cleaned = re_start_markdown.replace(&cleaned, "").to_string();
    cleaned = re_start.replace(&cleaned, "").to_string();
    
    // 移除结尾的 ```
    let re_end = Regex::new(r"\n```\s*$").unwrap();
    cleaned = re_end.replace(&cleaned, "").to_string();
    
    // 确保文件以换行符结尾
    if !cleaned.ends_with('\n') {
        cleaned.push('\n');
    }
    
    cleaned.trim().to_string() + "\n"
}

#[tauri::command]
fn push_daily_report(date: String, content: String, github_pat: String, member_id: String, team_dir: String) -> Result<String, String> {
    // 清理 Markdown 格式（移除多余的代码块包裹）
    let cleaned_content = clean_markdown_content(&content);
    println!("✅ 已清理 Markdown 格式");
    
    // 使用用户配置的路径或默认路径
    let report_dir = get_report_dir()?;
    
    // 如果目录不存在，自动创建
    if !report_dir.exists() {
        std::fs::create_dir_all(&report_dir)
            .map_err(|e| format!("创建日报目录失败: {}", e))?;
        println!("✅ 已创建日报目录: {:?}", report_dir);
    }
    
    // 1. 保存日报到本地文件（格式：YYYY.MM.DD.md）
    let date_formatted = date.replace("-", ".");
    let report_file = report_dir.join(format!("{}.md", date_formatted));
    
    fs::write(&report_file, &cleaned_content)
        .map_err(|e| format!("保存日报文件失败: {}", e))?;
    
    println!("✅ 日报已保存到: {:?}", report_file);
    
    // 2. 使用 Rust 直接推送到 GitHub（无需 Python）
    let repo = "AIEC-Team/AIEC-agent-hub";
    let path = format!("成员日志 members/{}/{}/{}_log.md", team_dir, member_id, date);
    let url = format!("https://api.github.com/repos/{}/contents/{}", repo, path);
    
    println!("📤 推送路径: {}", path);
    
    // 创建 HTTP 客户端
    let client = reqwest::blocking::Client::new();
    
    // 检查文件是否已存在（获取 SHA）
    let mut sha: Option<String> = None;
    match client
        .get(&url)
        .header("Authorization", format!("token {}", github_pat))
        .header("User-Agent", "Chronicle-App")
        .send()
    {
        Ok(resp) => {
            if resp.status().is_success() {
                if let Ok(file_resp) = resp.json::<GitHubFileResponse>() {
                    sha = Some(file_resp.sha);
                    println!("📝 文件已存在，将更新（SHA: {}）", sha.as_ref().unwrap());
                }
            }
        }
        Err(e) => println!("ℹ️ 文件不存在，将创建新文件: {}", e),
    }
    
    // Base64 编码内容（使用清理后的内容）
    let content_base64 = base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        cleaned_content.as_bytes()
    );
    
    // 构建请求体
    let request_body = GitHubFileRequest {
        message: format!("📝 [{}] Sync log for {}", member_id, date),
        content: content_base64,
        branch: "main".to_string(),
        sha: sha,
    };
    
    // 发送 PUT 请求
    let response = client
        .put(&url)
        .header("Authorization", format!("token {}", github_pat))
        .header("User-Agent", "Chronicle-App")
        .json(&request_body)
        .send()
        .map_err(|e| format!("GitHub API 请求失败: {}", e))?;
    
    let status = response.status();
    let response_text = response.text().unwrap_or_default();
    
    println!("📊 HTTP 状态: {}", status);
    println!("📊 响应内容: {}", response_text);
    
    if status.is_success() {
        Ok(format!(
            "✅ 日报推送成功！\n\n日期: {}\n成员: {}\n团队: {}\n路径: {}\n本地文件: {:?}\n\nHTTP 状态: {}", 
            date, member_id, team_dir, path, report_file, status
        ))
    } else {
        Err(format!(
            "❌ 推送失败\n\nHTTP 状态: {}\n响应: {}",
            status, response_text
        ))
    }
}

// 获取日报保存路径（优先使用用户配置）
fn get_report_dir() -> Result<std::path::PathBuf, String> {
    // 从配置文件读取用户自定义路径
    if let Some(config_dir) = dirs::config_dir() {
        let config_file = config_dir.join("Chronicle").join("config.json");
        if config_file.exists() {
            if let Ok(config_content) = fs::read_to_string(&config_file) {
                if let Ok(config) = serde_json::from_str::<serde_json::Value>(&config_content) {
                    if let Some(custom_path) = config.get("report_dir").and_then(|v| v.as_str()) {
                        let path = std::path::PathBuf::from(custom_path);
                        if path.exists() || fs::create_dir_all(&path).is_ok() {
                            println!("✅ 使用用户自定义路径: {:?}", path);
                            return Ok(path);
                        }
                    }
                }
            }
        }
    }
    
    // 使用默认路径
    let report_dir = dirs::document_dir()
        .ok_or("无法获取文档目录")?
        .join("Chronicle")
        .join("日报");
    
    Ok(report_dir)
}

// 保存日报路径配置
#[tauri::command]
fn set_report_dir(path: String) -> Result<String, String> {
    let config_dir = dirs::config_dir()
        .ok_or("无法获取配置目录")?
        .join("Chronicle");
    
    fs::create_dir_all(&config_dir)
        .map_err(|e| format!("创建配置目录失败: {}", e))?;
    
    let config_file = config_dir.join("config.json");
    let config = serde_json::json!({
        "report_dir": path
    });
    
    fs::write(&config_file, serde_json::to_string_pretty(&config).unwrap())
        .map_err(|e| format!("保存配置失败: {}", e))?;
    
    Ok(format!("✅ 日报保存路径已设置为: {}", path))
}

// 获取当前日报路径
#[tauri::command]
fn get_current_report_dir() -> Result<String, String> {
    let dir = get_report_dir()?;
    Ok(dir.to_string_lossy().to_string())
}

// 打开目录选择对话框
#[tauri::command]
async fn select_directory(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    
    let result = app.dialog()
        .file()
        .set_title("选择日报保存目录")
        .blocking_pick_folder();
    
    Ok(result.map(|path| path.to_string()))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())  // 后端插件
        .invoke_handler(tauri::generate_handler![
            clean_old_videos, 
            push_daily_report,
            set_report_dir,
            get_current_report_dir,
            select_directory
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

