// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};
use std::process::Command;

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

#[tauri::command]
fn push_daily_report(date: String, content: String, github_pat: String) -> Result<String, String> {
    // 获取用户主目录
    let home_dir = dirs::home_dir().ok_or("无法获取用户主目录")?;
    
    // 日报目录路径 - 使用 "日报" 目录
    let report_dir = home_dir.join("Desktop").join("chronicle").join("日报");
    
    if !report_dir.exists() {
        return Err(format!("日报目录不存在: {:?}", report_dir));
    }
    
    // 1. 保存日报到本地文件（格式：YYYY.MM.DD.md）
    let date_formatted = date.replace("-", ".");
    let report_file = report_dir.join(format!("{}.md", date_formatted));
    
    fs::write(&report_file, &content)
        .map_err(|e| format!("保存日报文件失败: {}", e))?;
    
    println!("✅ 日报已保存到: {:?}", report_file);
    
    // 2. 调用 Python 脚本推送到 GitHub
    let python_script = report_dir.join("push_my_log.py");
    
    if !python_script.exists() {
        return Err(format!("推送脚本不存在: {:?}", python_script));
    }
    
    // 检查是否有虚拟环境
    let venv_python = report_dir.join(".venv").join("bin").join("python3");
    let python_cmd = if venv_python.exists() {
        venv_python.to_str().unwrap()
    } else {
        "python3"
    };
    
    // 执行 Python 脚本，通过环境变量传递 PAT
    let output = Command::new(python_cmd)
        .arg(python_script.to_str().unwrap())
        .current_dir(&report_dir)
        .env("GITHUB_PAT_TEAM_HUB", github_pat)
        .env("PYTHONIOENCODING", "utf-8")
        .output()
        .map_err(|e| format!("执行推送脚本失败: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    
    if !output.status.success() {
        return Err(format!(
            "推送失败:\nstdout: {}\nstderr: {}",
            stdout, stderr
        ));
    }
    
    println!("✅ Python 脚本输出:\n{}", stdout);
    
    // 检查输出中是否包含成功标志
    if stdout.contains("上传成功") || stdout.contains("status: 200") || stdout.contains("status: 201") {
        Ok(format!("日报推送成功！\n日期: {}\n文件: {:?}", date, report_file))
    } else {
        // 返回详细输出帮助调试
        Ok(format!(
            "推送完成（请检查结果）:\n{}\n{}",
            stdout, stderr
        ))
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![clean_old_videos, push_daily_report])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

