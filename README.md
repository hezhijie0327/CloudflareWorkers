# Cloudflare Workers 工具集

这个仓库包含了多个实用的 Cloudflare Workers 脚本，用于提供各种网络代理和服务功能。

## 项目概览

| 目录 | 功能 |
| --- | --- |
| `container-proxy/` | 容器镜像仓库代理（Docker Hub、GHCR、quay.io、gcr.io 等 9 个源，支持 login/pull） |
| `reverse-proxy/` | 通用反向代理（任意 URL 透传、网页改写、SPA 适配、git 与 WebSocket 支持） |

## 部署方法

### 准备工作

1. 注册 Cloudflare 账号
2. 安装 Wrangler CLI：

```bash
npm install -g wrangler
```

3. 登录 Cloudflare：

```bash
wrangler auth login
```

### 部署单个 Worker

每个 worker 位于独立目录（含 `worker.js` 与各自的 `wrangler.jsonc`，`name` 按需修改）：

```bash
# 部署容器代理
wrangler deploy --config container-proxy/wrangler.jsonc

# 部署通用反向代理
wrangler deploy --config reverse-proxy/wrangler.jsonc
```

## 注意事项

1. 所有脚本都包含 CORS 支持，可以跨域访问
2. 部署前请确保已正确配置 Cloudflare 账户和域名
3. 某些脚本可能需要根据实际使用场景进行配置调整
4. 建议在生产环境中使用自定义域名而不是 Workers 的默认域名

## 许可证

本项目采用Apache License 2.0 with Commons Clause v1.0许可证 - 详见[LICENSE](LICENSE)文件
