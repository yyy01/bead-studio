# bead studio

将照片、插画和像素画转换成拼豆图纸。支持自定义尺寸、品牌色卡、整色替换预览、用量清单及 PNG / SVG / JSON 导出。

公网部署只需发布 `dist/`，不需要后端或数据库。Cloudflare Pages 与自建服务器配置见 [部署说明](DEPLOYMENT.md)。

Static image-to-bead-pattern tool. No npm installation or server API is required.

```sh
python3 -m http.server 8000 --directory dist
node test.mjs
node validation/test-photo.mjs
node validation/test-edits.mjs
```

Open `http://localhost:8000`. The default photographic style is `crisp` (清晰轮廓); `faithful` preserves the area-sampling path. Image processing runs in a Worker. All output colors come from the selected bead palette; whole-color replacements are previewed before application and can be undone.

## V3 reproduction

See `dist/research.html` for full methods, limitations, all 104 parameter cases, actual outputs, and performance timing. Algorithm-only changes can be checked with the test scripts above. Image analysis and report generation require Python with NumPy and Pillow.

```sh
PHOTOS=astronaut,chelsea,coffee,camera,rocket,brick,grass,gravel,clock_motion,coins,moon,hubble_deep_field,motorcycle_left \
VARIANTS=v2,v3,balanced TAG=v3-final node validation/benchmark-v3.mjs
node validation/reference-v3.mjs v3-final
python3 validation/analyze-v3.py v3-final
node validation/performance-v3.mjs
node validation/benchmark-flags-v3.mjs
python3 validation/analyze-v3.py v3-flags
python3 validation/build-report-v3.py
```

The report builder writes to `../../outputs` as well as `dist/research.html`; create the output directory or adjust that path when moving this checkout elsewhere. `validation/engine-v2.mjs` preserves the previous deployed algorithm. Rejected kernel and priority-weight experiments are in `validation/engine-experimental.mjs` and `validation/sampling-experiments.mjs`; historical results remain available separately.

Photo tests use 13 originals, not 104 independent photographs. These images were used for development and regression; no blinded user study was conducted. SSIM depends on its reference resizer. The report includes Lanczos, Bicubic, and linear-area references, color errors, singletons, and regressions.

Palette RGB values are community approximations, not calibrated physical bead colors. See `THIRD_PARTY_NOTICES.txt` for data sources and references.
