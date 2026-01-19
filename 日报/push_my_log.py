import requests, base64, os, datetime, pathlib

REPO = "AIEC-Team/AIEC-agent-hub"

def push_log(member_id, team_dir, date, content):
    token = os.environ.get("GITHUB_PAT_TEAM_HUB", "").strip()
    if not token:
        raise SystemExit("缺少环境变量 GITHUB_PAT_TEAM_HUB，用于存放 GitHub PAT")

    headers = {"Authorization": f"token {token}"}
    # 路径格式，完全按 INTEGRATION_SPEC 里的说明
    path = f"成员日志 members/{team_dir}/{member_id}/{date}_log.md"
    url = f"https://api.github.com/repos/{REPO}/contents/{path}"
    
    # 检查是否已有文件（为了拿 sha）——照文档模板
    sha = None
    r = requests.get(url, headers=headers)
    if r.status_code == 200:
        sha = r.json()["sha"]
    
    data = {
        "message": f"📝 [{member_id}] Sync log for {date}",
        "content": base64.b64encode(content.encode()).decode(),
        "branch": "main"
    }
    if sha:
        data["sha"] = sha
    
    resp = requests.put(url, headers=headers, json=data)
    print("status:", resp.status_code)
    try:
        print(resp.json())
    except Exception:
        print(resp.text)
    return resp

if __name__ == "__main__":
    # 从环境变量读取，如果没有则使用默认值
    member_id = os.environ.get("MEMBER_ID", "金倩如")
    team_dir = os.environ.get("TEAM_DIR", "中国团队 china-team")
    
    print(f"📋 成员名称: {member_id}")
    print(f"🌏 团队目录: {team_dir}")

    today = datetime.date.today()
    date = today.strftime("%Y-%m-%d")

    base_dir = pathlib.Path(__file__).resolve().parent
    local_md = base_dir / f"{today.strftime('%Y.%m.%d')}.md"

    if not local_md.exists():
        # 尝试查找任何日期的 md 文件（最新的）
        md_files = sorted(base_dir.glob("*.md"), key=lambda p: p.stat().st_mtime, reverse=True)
        if md_files:
            local_md = md_files[0]
            print(f"使用最新的日报文件: {local_md}")
        else:
            raise SystemExit(f"本地日报文件不存在: {local_md}")

    content = local_md.read_text(encoding="utf-8")

    resp = push_log(member_id, team_dir, date, content)

    status = resp.status_code
    if status in (200, 201):
        print(f"上传成功：{date}_log.md")
    else:
        raise SystemExit(f"上传失败，HTTP {status}")
