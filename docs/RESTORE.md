# 新電腦還原指南（換電腦必讀）

> 建立日期：2026-07-08。原電腦歸還前的完整備份說明。

## 一、專案清單（都在 GitHub：帳號 eaea128-hash）

| 專案 | GitHub Repo | 說明 |
|---|---|---|
| smart（CloudFrame） | https://github.com/eaea128-hash/smart-archie | 主專案，Cloudflare Pages 部署 |
| vivi-felt-studio | https://github.com/eaea128-hash/vivi-felt-studio | 羊毛氈工作室網站 |
| intel-agent | https://github.com/eaea128-hash/intel-agent | 新聞部落格（RSS 自動抓取） |

## 二、新電腦還原步驟

### 1. 安裝基本工具
- Git：https://git-scm.com/download/win
- Node.js（LTS）：https://nodejs.org
- Claude Code：`npm install -g @anthropic-ai/claude-code`

### 2. Clone 專案
```bash
git clone https://github.com/eaea128-hash/smart-archie.git
git clone https://github.com/eaea128-hash/vivi-felt-studio.git
git clone https://github.com/eaea128-hash/intel-agent.git
```

### 3. 還原 `.env`（金鑰不在 git 裡！）
smart 專案根目錄需要 `.env`，包含以下變數（值請從你的密碼管理器/備忘錄取回）：
```
ANTHROPIC_API_KEY=
ALLOWED_ORIGINS=
CLAUDE_MAX_TOKENS=
CLAUDE_MODEL=
NODE_ENV=
RATE_LIMIT_RPH=
URL=
```
格式範例見 `.env.example`。

### 4. 還原 Claude Code Skills / Commands
- **專案層級**：clone 後 `.claude/commands/` 自動生效，不用做任何事。
- **使用者層級**（想在所有專案都能用的話）：
  ```bash
  # 在 smart 專案目錄執行（Windows Git Bash）
  mkdir -p ~/.claude/commands
  cp skills/*.md ~/.claude/commands/
  ```

### 5. 重新安裝 Plugins
在 Claude Code 內執行：
```
/plugin marketplace add samzhu/agent-skills
```
然後安裝以下 plugins（原電腦啟用清單）：
- research@samzhu-agent-skills
- handover@samzhu-agent-skills
- takeover@samzhu-agent-skills
- ui-craft@samzhu-agent-skills
- depx@samzhu-agent-skills
- retro@samzhu-agent-skills

### 6. 安裝相依套件
```bash
cd smart-archie && npm install
cd bank-resilience-intake-platform && npm install
```

## 三、沒有進 git 的東西（需另外保管）

| 項目 | 處理方式 |
|---|---|
| `.env`（API 金鑰） | 抄到密碼管理器或手機備忘錄 |
| 文章草稿 `drafts/`、研究筆記 `research/`、`style-profile.md` | 視 repo 是否轉私人決定進 git 或另存雲端硬碟 |

## 四、重要文件位置

- 專案記憶：`docs/PROJECT_MEMORY.md`
- Bug 追蹤：`docs/BUGS.md`
- Claude 工作規則：`CLAUDE.md`、`.claude/rules/general.md`
