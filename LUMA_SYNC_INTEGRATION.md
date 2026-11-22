# Bytewise -> Luma Offline Local Synchronization

Bytewise (`io.github.impostor343.cseroadmap`) remains the sole owner of all learning progress (1,179 sessions, 42 modules, 344 topics, IndexedDB `java-roadmap` v6). Luma (`io.github.impostor343.luma`) receives read-only copies completely offline via local Android IPC.

---

## IPC Contract (For Future Luma Implementation)

### 1. Permissions & Package Visibility
- **Bytewise declares**: `io.github.impostor343.cseroadmap.permission.BYTEWISE_SYNC_READ` (`android:protectionLevel="signature"`).
- **Luma must declare**: `io.github.impostor343.luma.permission.LUMA_SYNC_INGEST` (`android:protectionLevel="signature"`), and request `<uses-permission android:name="io.github.impostor343.cseroadmap.permission.BYTEWISE_SYNC_READ" />`.
- **Both apps must be signed with the exact same keystore** (shared debug keystore for debug builds, shared release keystore for release builds). Both sides verify `Binder.getCallingUid()`, package name, `PackageManager.SIGNATURE_MATCH`, and SHA-256 certificate equality.

### 2. Immediate Event Push (Bytewise -> Luma)
Bytewise calls Luma's exported `ContentProvider`:
- **Authority**: `io.github.impostor343.luma.bytewiseingest`
- **Method**: `ingestEvent` via `ContentResolver.call(uri, "ingestEvent", null, extras)`
- **Extras Bundle**:
  - `schemaVersion` (`int`): `1`
  - `sourceApp` (`String`): `"io.github.impostor343.cseroadmap"`
  - `sourceEpoch` (`String`): UUID rotated on backup restore
  - `eventId` (`String`): UUID v4 (idempotency key)
  - `seq` (`long`): monotonic sequence number
  - `eventType` (`String`): `"SESSION_COMPLETED"` | `"SESSION_REOPENED"` | `"SNAPSHOT_RESET"` | `"SNAPSHOT_READY"`
  - `createdAt` (`String`): UTC ISO-8601
  - `payloadJson` (`String`): JSON record preserving permanent `completionId`, `day`, `sessionId`, `moduleId`, `moduleName`, `topicId`, `topicName`, `title`, `phase`, `completedAt`, `localDate`, `localTime`, `reopenedAt`, `isActive`
- **Expected ACK Bundle returned by Luma**:
  - `status`: `"ACK"` | `"ACK_DUPLICATE"` | `"NEED_FULL_SYNC"` | `"REJECTED"`
  - `appliedSeq` (`long`, optional)
  - `reason` (`String`, optional)

### 3. Read-Only Pull & Full-History Recovery (Luma -> Bytewise)
Bytewise serves a strictly read-only `ContentProvider` (`BytewiseSyncProvider`, authority `io.github.impostor343.cseroadmap.lumasync`, protected by `BYTEWISE_SYNC_READ`):
- `content://io.github.impostor343.cseroadmap.lumasync/meta` — `schema_version`, `source_app`, `ready`, `source_epoch`, `latest_seq`, `active_count`, `total_records`, `pending_outbox_count`, `snapshot_hash`, `updated_at`
- `content://io.github.impostor343.cseroadmap.lumasync/events?sinceSeq=0&epoch=<UUID>&limit=500` — incremental delta events ordered by `seq ASC`
- `content://io.github.impostor343.cseroadmap.lumasync/snapshot` — complete canonical completion history (active + reopened) ordered by `completion_id ASC`

All write methods (`insert`, `bulkInsert`, `update`, `delete`) throw `UnsupportedOperationException`.

---

## Building the Shared Release Keystore & Release APK

Never commit your private release keystore or passwords to GitHub.

### Step 1: Generate one shared release keystore locally (use for BOTH Bytewise and Luma)
```bash
keytool -genkeypair -v \
  -keystore bytewise-luma-shared-release.jks \
  -alias bytewise-luma \
  -keyalg RSA -keysize 4096 -validity 10000
```
Store `bytewise-luma-shared-release.jks` in a safe offline backup (password manager / encrypted drive).

### Step 2A: Build Release APK via GitHub Actions (Recommended)
1. Base64-encode the keystore locally:
   ```bash
   base64 -w 0 bytewise-luma-shared-release.jks > keystore.b64
   ```
2. Add these four repository **Actions Secrets** (Settings -> Secrets and variables -> Actions) in BOTH the Bytewise repo and the future Luma repo:
   - `SHARED_RELEASE_KEYSTORE_B64` (contents of `keystore.b64`)
   - `SHARED_RELEASE_KEYSTORE_PASSWORD`
   - `SHARED_RELEASE_KEY_ALIAS` (e.g. `bytewise-luma`)
   - `SHARED_RELEASE_KEY_PASSWORD`
3. Delete local `keystore.b64`.
4. Go to **Actions -> Build Android APK -> Run workflow -> `build_type: release`**.

### Step 2B: Build Release APK Locally (Requires Node 22, Python 3, JDK 21, Android SDK)
```bash
npm install
npm run prepare-web
npx cap add android
npx cap sync android
python3 android-build/add_widgets.py
python3 android-build/add_luma_sync.py
python3 android-build/configure_signing.py

export SHARED_RELEASE_KEYSTORE_PATH="/absolute/path/to/bytewise-luma-shared-release.jks"
export SHARED_RELEASE_KEYSTORE_PASSWORD="your-store-password"
export SHARED_RELEASE_KEY_ALIAS="bytewise-luma"
export SHARED_RELEASE_KEY_PASSWORD="your-key-password"

cd android && ./gradlew assembleRelease --no-daemon
# Output: android/app/build/outputs/apk/release/app-release.apk
```
To build a Debug APK locally instead:
```bash
mkdir -p ~/.android && cp android-build/debug.keystore ~/.android/debug.keystore
cd android && ./gradlew assembleDebug --no-daemon
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```
