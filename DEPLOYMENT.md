# 公网部署

bead studio 是静态网页。照片采样、颜色量化与图纸生成均在访问者浏览器的 Worker 中执行；当前版本没有服务器端图片上传、账户、数据库或云端工程存储。

发布目录是 **`dist/`**。不要把整个仓库设成网站根目录。源码、测试脚本和照片测试数据不需要作为网站资源公开提供。

## 方案一：Cloudflare Pages

适合先免费上线、绑定域名并随 GitHub 提交自动更新。

1. 在 Cloudflare 控制台进入 Workers & Pages，创建 **Pages** 项目，导入 `yyy01/bead-studio`。
2. 生产分支选 `main`，框架预设选 `None`。
3. 构建命令填 `exit 0`；输出目录填 `dist`；根目录保留仓库根目录。
4. 部署成功后使用平台分配的 `*.pages.dev` 地址，或在项目中绑定自己的域名。

无须安装 npm 依赖、配置环境变量或创建 Functions。当前官方说明：静态资源请求免费且不限量；免费计划每月允许 500 次构建。域名注册费用另计。面向中国大陆的实际访问表现需用目标网络测试，免费托管不等于大陆网络质量承诺。

官方说明：
- https://developers.cloudflare.com/pages/framework-guides/deploy-anything/
- https://developers.cloudflare.com/pages/functions/pricing/
- https://developers.cloudflare.com/pages/platform/limits/

## 方案二：自己的 Linux 服务器 + Caddy

需要公网 IP、Linux 服务器和域名。当前应用只提供静态文件，可先从 1 核 / 1 GB 的轻量服务器起步，关注出口带宽与实际访问延迟；以后加入账户、数据库或服务器端 AI 算法时再重新评估配置。

国内访问优先且愿意办理备案，可选择中国内地地域的阿里云或腾讯云轻量服务器。若使用中国香港等非内地地域，应先测试目标网络的延迟与稳定性；地域名称本身不保证大陆访问质量。服务器套餐、新购与续费价格按下单时控制台报价确认。

在已安装 Git 和 Caddy 的 Linux 服务器上：

```sh
sudo mkdir -p /srv/bead-studio
sudo chown "$USER":"$(id -gn)" /srv/bead-studio
git clone https://github.com/yyy01/bead-studio.git /srv/bead-studio
```

将域名的 DNS A 记录指向服务器公网 IPv4。如配置 AAAA，IPv6 也必须正确可达。按实际域名编辑 `deploy/Caddyfile.example`，将其内容合并进 `/etc/caddy/Caddyfile`；已有其他网站时保留原配置。

```caddyfile
bead.example.com {
    root * /srv/bead-studio/dist
    encode zstd gzip
    file_server
}
```

确认 Caddy 服务用户可读取 `dist/`，云安全组与系统防火墙允许 TCP 80/443，然后检查并加载配置：

```sh
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
```

对正确解析且公网可达的域名，Caddy 会自动申请与续期 HTTPS 证书。仅提供配置示例，此仓库尚未替你购买服务器、配置 DNS 或执行远程部署。

后续更新：

```sh
cd /srv/bead-studio
git pull --ff-only
```

静态文件更新通常不需要重启 Caddy；配置变化时再校验和 reload。回退可切换到之前的 Git 提交。

官方说明：
- 安装 Caddy：https://caddyserver.com/docs/install
- 静态文件：https://caddyserver.com/docs/quick-starts/static-files
- 自动 HTTPS：https://caddyserver.com/docs/automatic-https
- 阿里云地域与备案说明：https://help.aliyun.com/zh/simple-application-server/product-overview/usage-notes
- 腾讯云轻量 ICP 备案：https://cloud.tencent.com/document/product/1207/45756

## 方案三：GitHub Pages

当前仓库为 public，可使用 GitHub Free 的 Pages。项目站点通常位于 `https://yyy01.github.io/bead-studio/`。应通过 Pages 发布工作流上传 `dist/`；不要直接把仓库根目录作为网站内容。此仓库尚未启用 Pages 或添加自动发布工作流。

官方说明：https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages

## 上线后检查

- 使用实际域名打开网页，上传一张图片，确认生成和颜色替换正常。
- 检查 Worker 与 `.mjs` 模块可加载；测试 PNG / SVG / JSON 导出。
- 确认 `research.html` 测试记录可访问，手机宽度下可以操作。
- 本机处理的性能受访问者设备影响；升级服务器不会直接加速浏览器中的图片算法。
