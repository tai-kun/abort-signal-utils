# Changelog

## abort-signal-utils@0.0.5

### 新機能

- timeoutSignal を追加 ([bc469c6](https://github.com/tai-kun/abort-signal-utils/commit/bc469c6a93597ddece5bcab77009b0991d107965))
- combineSignals に cleanupSignal を追加 ([19b3bf8](https://github.com/tai-kun/abort-signal-utils/commit/19b3bf87e36aca0c92d43127c95c9e666daa0886))
- withSignal を追加 ([1e2bfe4](https://github.com/tai-kun/abort-signal-utils/commit/1e2bfe4a29a9278265a9292e291214c85ae87170))
- `toAbortPromise` とドキュメントサイトを追加 ([75ddc62](https://github.com/tai-kun/abort-signal-utils/commit/75ddc62d1de386e85bc3a0368eb3794d662f6c6c))
- combineSignalsFast を追加 ([ccf1e0b](https://github.com/tai-kun/abort-signal-utils/commit/ccf1e0bf26e616a07e6cdfe2bd5521ccd0a3284e))

### バグ修正

- AbortSignal.any がある環境で未中断の cleanupSignal を使うと代替実装に切り替わるため console.log で知らせる ([3db8e45](https://github.com/tai-kun/abort-signal-utils/commit/3db8e45d51f8dc8e5e82009afe1c2209110c7c0f))
- fix ([b629fc2](https://github.com/tai-kun/abort-signal-utils/commit/b629fc22ef3f3d28d6901ec8198a03a3f4c3d4f5))

### パフォーマンス改善

- 全体的に見直し ([bc493b5](https://github.com/tai-kun/abort-signal-utils/commit/bc493b57f2028edc252f4e5d1673c263ef1699f6))

### ドキュメント

- 公開 ([9411a53](https://github.com/tai-kun/abort-signal-utils/commit/9411a53dda82106645e1ec158df265e319e21885))

### テスト

- リファクタ ([a6739ed](https://github.com/tai-kun/abort-signal-utils/commit/a6739edb8b83384f21c246b54794707661e1ecc7))
- リファクタ ([2bb77a2](https://github.com/tai-kun/abort-signal-utils/commit/2bb77a2976cf7878220c0db3081e524991dbb152))

### その他

- 設定を修正 ([c00c96e](https://github.com/tai-kun/abort-signal-utils/commit/c00c96e34b72eaff0c435c635b398ee45e9c5035))
- パッケージを更新 ([2d9e2b5](https://github.com/tai-kun/abort-signal-utils/commit/2d9e2b5f48ab4b0934ee262fe8b5ec72b1282e66))
- 最初のコミット ([93f777b](https://github.com/tai-kun/abort-signal-utils/commit/93f777b3cf6566b9283511ba0ea953945c374312))

**Full Changelog**: https://github.com/tai-kun/abort-signal-utils/commits/abort-signal-utils@0.0.5
