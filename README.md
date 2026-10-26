# Claude Desktop Code / Cowork 简体中文补丁

适配 **Windows x64 Claude Desktop 3.6556.2（安装包 3.6556.2.0）**。

非官方项目，当前是预发布版本。目标是桌面应用中的 Code 与 Cowork，不适用于独立 Claude Code CLI。完整界面验收尚未完成，详情见 [验证状态](VALIDATION.md)。

## 当前覆盖

- 公共语言目录 37,201 条，31,153 条已有翻译（约 83.7%），6,048 条保留英文。
- 动态语言目录 49 条均已翻译。
- 真实运行中已通过无障碍接口确认 Cowork 首页主要提示、侧栏和建议任务显示中文。
- Code 页面、模型菜单、设置页面、视觉排版和任务执行仍待验收。Code、Cowork、Claude 以及模型名保留原名。

## 安装

需要自行安装对应版本的正版 Claude Desktop、Node.js 20 或更高版本。补丁会校验原版可执行文件、ASAR 和 1,133 个待修改资源的 SHA-256；版本不符时拒绝执行。

1. 下载 Release 中的补丁 ZIP 并解压，或克隆此仓库。
2. 在解压目录打开 PowerShell，安装固定依赖：

   ```powershell
   npm ci --ignore-scripts
   ```

3. 指定原版 `app` 目录和一个尚不存在的副本目录，例如：

   ```powershell
   node .\localize.mjs 'C:\Program Files\WindowsApps\Claude_3.6556.2.0_x64__pzs8sxrjxfjjc\app' 'D:\Claude-3.6556.2-zh-CN\app'
   ```

   如果安装路径不同，请替换第一个参数。输出目录必须独立于原版目录，且不能已经存在。执行时会复制应用并只修改副本的语言资源；需要约 1 GB 可用空间。若中途失败，请选一个新的输出目录重试。

4. 完成正在运行的 Claude 任务，通过托盘正常退出原版 Claude，再手动启动输出目录中的 `claude.exe`。
5. 在应用可用的语言设置中选择简体中文并重启。本机验证环境原有语言为 `zh-CN`；首次切换语言的流程尚未验收。如果界面仍是英文，请记录应用版本和语言设置用于排查。

独立副本仍可能与原版使用相同的用户配置和单实例锁，不保证可同时运行或保留同样的历史展示。不自动结束进程，不修改登录信息、网关、模型路由、服务或原版安装目录。退出副本并重新打开原版即可切回；应用更新后须重新确认版本兼容性。

## 发布内容

ZIP 包含补丁脚本、翻译词库、固定依赖清单、文件校验和说明；不含 Claude 原版程序、完整前端程序、用户配置、账号、会话、日志或网关密钥。运行时从你本机的合法安装复制所需程序。

`Claude.exe` 和 `resources/app.asar` 保持原样，不绕过签名或 ASAR 完整性检查；外部前端资源经过修改，不应将可执行文件签名有效等同于整个修改后的应用获得官方签名。

## 来源与许可

翻译词库基于 [javaht/claude-desktop-zh-cn](https://github.com/javaht/claude-desktop-zh-cn)，固定修订 [b2d5a8394549d9a9f38a66b4aa6e53f1226a62d4](https://github.com/javaht/claude-desktop-zh-cn/tree/b2d5a8394549d9a9f38a66b4aa6e53f1226a62d4)，另补充当前版本的动态词条和部分界面翻译。保留其 MIT 许可及版权声明，见 [TRANSLATIONS-LICENSE.txt](TRANSLATIONS-LICENSE.txt)。本仓库新增补丁代码采用 MIT 许可。

Claude 及相关名称属于其权利人。本项目与 Anthropic 无关联，Claude 原版软件不属于本仓库 MIT 授权范围。补丁只处理界面文案，不提供账号、订阅或功能权限。
