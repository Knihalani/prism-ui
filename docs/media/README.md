# README media

Fresh captures from the playground on the integration-docs branch, after the
theme-default baseline fix (`973d450`). No image is a design mock-up.

- `host-shells.gif`: 1200 × 750, 64 Playwright PNG frames at 8 fps (8.01 s in
  GIF's centisecond timebase), 315,212 bytes. The scripted **Debug my failing
  deploy** reply stays in the conversation while switching **Chat → Editor →
  Workspace**, then **Host → Print**. No new model reply is requested between
  phases.
- `editor-artifact.png`: 1440 × 1000, 173,953 bytes. Editor/Host, widened
  assistant panel, scripted adaptive team dashboard.
- `workspace-print.png`: 1440 × 1000, 145,117 bytes. The adaptive dashboard
  in Workspace/Print.
- `theme-editor.png`: 2560 × 1680 (2× capture), 359,448 bytes. Chat/Host with the theme
  editor open, a draft named Fieldwork and a live brown accent override.

All three stills are lossless RGB PNGs, recompressed with FFmpeg's PNG encoder
at compression level 9. The screenshots and the GIF's four shell/theme phases
were inspected at capture time.

GIF encoding, starting from Playwright viewport screenshots named
`frames/000.png` through `frames/063.png`:

```sh
ffmpeg -filter_complex_threads 1 -framerate 8 -i frames/%03d.png \
  -filter_complex '[0:v]split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle' \
  -loop 0 host-shells.gif
```
