#!/bin/zsh
cd "/Users/jinqianru/Desktop/日报"
source .venv/bin/activate

echo -n "请输入 GitHub PAT: "
stty -echo
read PAT
stty echo
echo

export GITHUB_PAT_TEAM_HUB="$PAT"

python3 push_my_log.py
