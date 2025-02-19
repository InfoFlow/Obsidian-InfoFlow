# InfoFlow Obsidian 插件

此插件將 [InfoFlow](https://www.infoflow.app) 與 Obsidian 整合，讓您可以將保存的文章、網頁、筆記和重點直接同步到您的 Obsidian 倉庫。

InfoFlow 是一個個人知識管理系統 (PKMS)，它允許您從瀏覽器保存文章、網頁、X 貼文、YouTube 影片、筆記和重點，並將它們同步到您的 Obsidian 儲存庫。

此插件仍在開發中。
請使用 GitHub Issues 或向 [InfoFlow 支援](https://www.infoflow.app/support) 報告任何問題。感謝您的支持！

## 功能

- 將 InfoFlow 項目同步到您的 Obsidian 倉庫
- 自動將 HTML 內容轉換為 Markdown
- 可自訂的檔案命名模板
- 可自訂的筆記模板 (包含 frontmatter)
- 支援重點和註釋
- 按日期、標籤和資料夾過濾同步
- 手動和自動同步選項

## 安裝

1. 開啟 Obsidian 設定
2. 前往「社群外掛程式」並停用「安全模式」
3. 點擊「瀏覽」並搜尋 "InfoFlow"
4. 安裝插件並啟用它

## 設定

1. 取得您的 InfoFlow API 金鑰 (可在 <https://www.infoflow.app/user_portal/external_token> 創建)
   - 未來，使用此 API 金鑰將需要 InfoFlow 訂閱
2. 在 Obsidian 中開啟插件設定
3. 輸入您的 API 金鑰
4. 設定同步選項：
   - 同步筆記的目標資料夾
   - 檔案名稱模板
   - 筆記模板
   - 同步頻率

### 可用的模板變數

#### 檔案名稱模板
- `{{title}}` - 項目標題
- `{{id}}` - 項目 ID
- `{{itemType}}` - 項目類型 (web_page, pdf 等)

#### 筆記模板
- `{{title}}` - 項目標題
- `{{url}}` - 來源 URL
- `{{itemType}}` - 項目類型
- `{{author}}` - 作者元數據
- `{{tags}}` - 項目標籤
- `{{createdAt}}` - 創建日期
- `{{updatedAt}}` - 最後更新日期
- `{{content}}` - 主要內容
- `{{notes}}` - 重點/註釋部分

## 使用方法

### 手動同步
1. 點擊左側功能區中的 InfoFlow 同步圖示
2. 或使用命令面板並搜尋 "Sync InfoFlow Items"

### 自動同步
插件將根據您設定的同步頻率自動同步。

### 過濾
您可以通過以下方式過濾要同步的項目：
- 日期範圍
- 標籤
- 資料夾
- 最後更新時間

## 要求

- 一個有效的 InfoFlow Cloud 帳戶。 由於 Obsidian 插件的性質（需要一個集中式伺服器來同步文件），不支持使用 Google Drive 或 OneDrive 的本地版本。
- InfoFlow API 金鑰
- Obsidian v0.15.0 或更高版本

## 支援

- 訪問 [InfoFlow 支援](https://www.infoflow.app/support)
- 在 GitHub 上報告問題

## 授權

MIT 授權。詳情請參閱 LICENSE。
