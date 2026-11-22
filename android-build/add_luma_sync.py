#!/usr/bin/env python3
"""Adds the offline Bytewise -> Luma Android synchronization bridge, private SQLite mirror/outbox,
read-only ContentProvider, and signature-verified IPC manifest entries to the generated Capacitor Android project.

Run from the repo root AFTER `npx cap add android` and `python3 android-build/add_widgets.py`.
Uses only the Python standard library. Idempotent (safe to run multiple times)."""

import json
import os
import re
import sys

LUMA_PKG = "io.github.impostor343.luma"

cfg = json.load(open("capacitor.config.json", encoding="utf-8"))
PKG = cfg["appId"]
app = os.path.join("android", "app", "src", "main")
java_dir = os.path.join(app, "java", *PKG.split("."))
manifest_path = os.path.join(app, "AndroidManifest.xml")

if not os.path.isdir(java_dir):
    sys.exit("add_luma_sync: Android project not found at " + java_dir)
if not os.path.isfile(manifest_path):
    sys.exit("add_luma_sync: AndroidManifest.xml not found at " + manifest_path)


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    print("wrote", path)


JAVA = {}

JAVA["LumaSyncContract.java"] = r'''package PKG;

import android.net.Uri;

/**
 * Shared offline IPC contract between Bytewise (source of truth) and Luma (read-only consumer).
 */
public final class LumaSyncContract {
    private LumaSyncContract() {}

    public static final int SCHEMA_VERSION = 1;

    public static final String BYTEWISE_PACKAGE = "PKG";
    public static final String LUMA_PACKAGE = "LUMA_PKG";

    public static final String BYTEWISE_AUTHORITY = BYTEWISE_PACKAGE + ".lumasync";
    public static final String LUMA_INGEST_AUTHORITY = LUMA_PACKAGE + ".bytewiseingest";
    public static final Uri LUMA_INGEST_URI = Uri.parse("content://" + LUMA_INGEST_AUTHORITY);

    public static final String PERM_BYTEWISE_READ = BYTEWISE_PACKAGE + ".permission.BYTEWISE_SYNC_READ";
    public static final String PERM_LUMA_INGEST = LUMA_PACKAGE + ".permission.LUMA_SYNC_INGEST";

    // Read-only ContentProvider paths served by BytewiseSyncProvider
    public static final String PATH_META = "meta";
    public static final String PATH_EVENTS = "events";
    public static final String PATH_SNAPSHOT = "snapshot";

    // Method and Bundle keys for immediate Binder push into Luma's ingest provider
    public static final String METHOD_INGEST_EVENT = "ingestEvent";

    public static final String KEY_SCHEMA_VERSION = "schemaVersion";
    public static final String KEY_SOURCE_APP = "sourceApp";
    public static final String KEY_SOURCE_EPOCH = "sourceEpoch";
    public static final String KEY_EVENT_ID = "eventId";
    public static final String KEY_SEQ = "seq";
    public static final String KEY_EVENT_TYPE = "eventType";
    public static final String KEY_CREATED_AT = "createdAt";
    public static final String KEY_PAYLOAD_JSON = "payloadJson";

    public static final String KEY_STATUS = "status";
    public static final String KEY_APPLIED_SEQ = "appliedSeq";
    public static final String KEY_REASON = "reason";

    // Event types
    public static final String EVENT_SESSION_COMPLETED = "SESSION_COMPLETED";
    public static final String EVENT_SESSION_REOPENED = "SESSION_REOPENED";
    public static final String EVENT_SNAPSHOT_RESET = "SNAPSHOT_RESET";
    public static final String EVENT_SNAPSHOT_READY = "SNAPSHOT_READY";

    // Acknowledgement statuses returned by Luma
    public static final String ACK_OK = "ACK";
    public static final String ACK_DUPLICATE = "ACK_DUPLICATE";
    public static final String ACK_NEED_FULL_SYNC = "NEED_FULL_SYNC";
    public static final String ACK_REJECTED = "REJECTED";
}
'''

JAVA["LumaSyncAuth.java"] = r'''package PKG;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.ProviderInfo;
import android.content.pm.Signature;
import android.content.pm.SigningInfo;
import android.os.Binder;
import android.os.Build;
import android.os.Process;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Offline mutual authentication for Bytewise <-> Luma IPC.
 * Enforces both Android signature matching and runtime SHA-256 signing certificate equality.
 */
public final class LumaSyncAuth {
    private LumaSyncAuth() {}

    public static void enforceTrustedCaller(Context context) {
        if (context == null) {
            throw new SecurityException("Missing context for caller authentication");
        }
        int callingUid = Binder.getCallingUid();
        if (callingUid == Process.myUid()) {
            return;
        }
        PackageManager pm = context.getPackageManager();
        String[] packages = pm.getPackagesForUid(callingUid);
        if (packages == null || packages.length == 0) {
            throw new SecurityException("Unable to resolve calling package");
        }
        boolean matchesLuma = false;
        for (String pkg : packages) {
            if (LumaSyncContract.LUMA_PACKAGE.equals(pkg)) {
                matchesLuma = true;
                break;
            }
        }
        if (!matchesLuma) {
            throw new SecurityException("Caller package is not authorized");
        }
        if (!isTrustedLumaSignature(context)) {
            throw new SecurityException("Caller signing certificate does not match Bytewise");
        }
    }

    public static boolean isTrustedPeerInstalled(Context context) {
        if (context == null) {
            return false;
        }
        try {
            PackageManager pm = context.getPackageManager();
            ProviderInfo provider = pm.resolveContentProvider(LumaSyncContract.LUMA_INGEST_AUTHORITY, 0);
            if (provider == null || !LumaSyncContract.LUMA_PACKAGE.equals(provider.packageName)) {
                return false;
            }
            return isTrustedLumaSignature(context);
        } catch (Exception ex) {
            return false;
        }
    }

    public static boolean isTrustedLumaSignature(Context context) {
        try {
            PackageManager pm = context.getPackageManager();
            if (pm.checkSignatures(context.getPackageName(), LumaSyncContract.LUMA_PACKAGE)
                    != PackageManager.SIGNATURE_MATCH) {
                return false;
            }
            Set<String> selfCerts = getCertSha256Set(pm, context.getPackageName());
            Set<String> peerCerts = getCertSha256Set(pm, LumaSyncContract.LUMA_PACKAGE);
            if (selfCerts.isEmpty() || peerCerts.isEmpty()) {
                return false;
            }
            for (String digest : selfCerts) {
                if (peerCerts.contains(digest)) {
                    return true;
                }
            }
            return false;
        } catch (Exception ex) {
            return false;
        }
    }

    @SuppressWarnings("deprecation")
    private static Set<String> getCertSha256Set(PackageManager pm, String packageName) {
        Set<String> out = new HashSet<>();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                PackageInfo info = pm.getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES);
                if (info == null || info.signingInfo == null) {
                    return out;
                }
                SigningInfo si = info.signingInfo;
                Signature[] sigs = si.hasMultipleSigners()
                        ? si.getApkContentsSigners()
                        : si.getSigningCertificateHistory();
                if (sigs != null) {
                    for (Signature s : sigs) {
                        String d = sha256Hex(s.toByteArray());
                        if (d != null) {
                            out.add(d);
                        }
                    }
                }
            } else {
                PackageInfo info = pm.getPackageInfo(packageName, PackageManager.GET_SIGNATURES);
                if (info != null && info.signatures != null) {
                    for (Signature s : info.signatures) {
                        String d = sha256Hex(s.toByteArray());
                        if (d != null) {
                            out.add(d);
                        }
                    }
                }
            }
        } catch (Exception ignored) {
            // Package not installed or inaccessible
        }
        return out;
    }

    public static String sha256Hex(byte[] data) {
        if (data == null) {
            return null;
        }
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(data);
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                sb.append(String.format(Locale.US, "%02x", b & 0xff));
            }
            return sb.toString();
        } catch (Exception ex) {
            return null;
        }
    }
}
'''

JAVA["LumaSyncDbHelper.java"] = r'''package PKG;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Private SQLite storage owned exclusively by Bytewise for offline Luma synchronization.
 * Stores:
 *   1) session_records: canonical read-only mirror of Bytewise completions (active + reopened)
 *   2) outbox_events:   durable append-only delivery queue with deduplication and retry state
 *   3) sync_meta:       sync lineage (source_epoch), snapshot hash, and watermark state
 */
public final class LumaSyncDbHelper extends SQLiteOpenHelper {
    private static final String DB_NAME = "bytewise_luma_sync.db";
    private static final int DB_VERSION = 1;
    private static final int ACKED_RETENTION_LIMIT = 500;

    private static volatile LumaSyncDbHelper instance;

    public static LumaSyncDbHelper getInstance(Context context) {
        if (instance == null) {
            synchronized (LumaSyncDbHelper.class) {
                if (instance == null) {
                    instance = new LumaSyncDbHelper(context.getApplicationContext());
                }
            }
        }
        return instance;
    }

    public static final class OutboxEvent {
        public final long seq;
        public final String eventId;
        public final String sourceEpoch;
        public final String eventType;
        public final long completionId;
        public final int day;
        public final String payloadJson;
        public final String createdAt;
        public final int attempts;
        public final long nextRetryAt;

        public OutboxEvent(long seq, String eventId, String sourceEpoch, String eventType,
                           long completionId, int day, String payloadJson, String createdAt,
                           int attempts, long nextRetryAt) {
            this.seq = seq;
            this.eventId = eventId;
            this.sourceEpoch = sourceEpoch;
            this.eventType = eventType;
            this.completionId = completionId;
            this.day = day;
            this.payloadJson = payloadJson;
            this.createdAt = createdAt;
            this.attempts = attempts;
            this.nextRetryAt = nextRetryAt;
        }
    }

    public static final class EnqueueResult {
        public final boolean enqueued;
        public final long seq;
        public final String eventId;
        public final String snapshotHash;

        public EnqueueResult(boolean enqueued, long seq, String eventId, String snapshotHash) {
            this.enqueued = enqueued;
            this.seq = seq;
            this.eventId = eventId;
            this.snapshotHash = snapshotHash;
        }
    }

    public static final class SnapshotResult {
        public final boolean changed;
        public final boolean epochChanged;
        public final int recordCount;
        public final int activeCount;
        public final String snapshotHash;

        public SnapshotResult(boolean changed, boolean epochChanged, int recordCount,
                              int activeCount, String snapshotHash) {
            this.changed = changed;
            this.epochChanged = epochChanged;
            this.recordCount = recordCount;
            this.activeCount = activeCount;
            this.snapshotHash = snapshotHash;
        }
    }

    private LumaSyncDbHelper(Context context) {
        super(context, DB_NAME, null, DB_VERSION);
        setWriteAheadLoggingEnabled(true);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL(
            "CREATE TABLE session_records (" +
            "  completion_id INTEGER PRIMARY KEY," +
            "  day INTEGER NOT NULL," +
            "  session_id TEXT NOT NULL," +
            "  module_id TEXT NOT NULL," +
            "  module_name TEXT NOT NULL," +
            "  topic_id TEXT NOT NULL," +
            "  topic_name TEXT NOT NULL," +
            "  title TEXT NOT NULL," +
            "  phase TEXT NOT NULL," +
            "  completed_at TEXT NOT NULL," +
            "  local_date TEXT NOT NULL," +
            "  local_time TEXT NOT NULL," +
            "  reopened_at TEXT," +
            "  is_active INTEGER NOT NULL," +
            "  source_epoch TEXT NOT NULL," +
            "  updated_at TEXT NOT NULL" +
            ")"
        );
        db.execSQL("CREATE INDEX idx_session_records_day ON session_records(day)");
        db.execSQL("CREATE INDEX idx_session_records_active ON session_records(is_active)");

        db.execSQL(
            "CREATE TABLE outbox_events (" +
            "  seq INTEGER PRIMARY KEY AUTOINCREMENT," +
            "  event_id TEXT NOT NULL UNIQUE," +
            "  dedupe_key TEXT NOT NULL UNIQUE," +
            "  source_epoch TEXT NOT NULL," +
            "  event_type TEXT NOT NULL," +
            "  completion_id INTEGER NOT NULL," +
            "  day INTEGER NOT NULL," +
            "  payload_json TEXT NOT NULL," +
            "  created_at TEXT NOT NULL," +
            "  state TEXT NOT NULL," +
            "  attempts INTEGER NOT NULL DEFAULT 0," +
            "  next_retry_at INTEGER NOT NULL DEFAULT 0," +
            "  acked_at TEXT," +
            "  last_error TEXT" +
            ")"
        );
        db.execSQL("CREATE INDEX idx_outbox_state_seq ON outbox_events(state, seq)");
        db.execSQL("CREATE INDEX idx_outbox_epoch_seq ON outbox_events(source_epoch, seq)");

        db.execSQL(
            "CREATE TABLE sync_meta (" +
            "  k TEXT PRIMARY KEY," +
            "  v TEXT NOT NULL" +
            ")"
        );
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        // Version 1 initial schema; future upgrades must remain additive to preserve history.
    }

    public static String nowIso() {
        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        fmt.setTimeZone(TimeZone.getTimeZone("UTC"));
        return fmt.format(new Date());
    }

    private static String safeStr(JSONObject obj, String key) {
        if (obj == null || obj.isNull(key)) {
            return "";
        }
        return obj.optString(key, "");
    }

    private static String nullableStr(JSONObject obj, String key) {
        if (obj == null || obj.isNull(key)) {
            return null;
        }
        String v = obj.optString(key, "");
        return v.isEmpty() ? null : v;
    }

    private void putMeta(SQLiteDatabase db, String key, String value) {
        ContentValues cv = new ContentValues();
        cv.put("k", key);
        cv.put("v", value == null ? "" : value);
        db.insertWithOnConflict("sync_meta", null, cv, SQLiteDatabase.CONFLICT_REPLACE);
    }

    private String getMeta(SQLiteDatabase db, String key, String fallback) {
        Cursor c = db.query("sync_meta", new String[]{"v"}, "k = ?", new String[]{key}, null, null, null);
        try {
            if (c.moveToFirst()) {
                return c.getString(0);
            }
            return fallback;
        } finally {
            c.close();
        }
    }

    private ContentValues recordToValues(JSONObject rec, String epoch, String updatedAt) {
        long completionId = rec.optLong("completionId", -1L);
        int day = rec.optInt("day", 0);
        String reopenedAt = nullableStr(rec, "reopenedAt");
        int isActive = (reopenedAt == null && rec.optBoolean("isActive", true)) ? 1 : 0;
        ContentValues cv = new ContentValues();
        cv.put("completion_id", completionId);
        cv.put("day", day);
        cv.put("session_id", safeStr(rec, "sessionId"));
        cv.put("module_id", safeStr(rec, "moduleId"));
        cv.put("module_name", safeStr(rec, "moduleName"));
        cv.put("topic_id", safeStr(rec, "topicId"));
        cv.put("topic_name", safeStr(rec, "topicName"));
        cv.put("title", safeStr(rec, "title"));
        cv.put("phase", safeStr(rec, "phase"));
        cv.put("completed_at", safeStr(rec, "completedAt"));
        cv.put("local_date", safeStr(rec, "localDate"));
        cv.put("local_time", safeStr(rec, "localTime"));
        if (reopenedAt == null) {
            cv.putNull("reopened_at");
        } else {
            cv.put("reopened_at", reopenedAt);
        }
        cv.put("is_active", isActive);
        cv.put("source_epoch", epoch);
        cv.put("updated_at", updatedAt);
        return cv;
    }

    private String recomputeSnapshotHash(SQLiteDatabase db) {
        StringBuilder sb = new StringBuilder();
        Cursor c = db.query(
            "session_records",
            new String[]{"completion_id", "day", "session_id", "completed_at", "reopened_at", "is_active"},
            null, null, null, null, "completion_id ASC"
        );
        try {
            while (c.moveToNext()) {
                sb.append(c.getLong(0)).append('|')
                  .append(c.getInt(1)).append('|')
                  .append(c.getString(2)).append('|')
                  .append(c.getString(3)).append('|')
                  .append(c.isNull(4) ? "" : c.getString(4)).append('|')
                  .append(c.getInt(5)).append('\n');
            }
        } finally {
            c.close();
        }
        String hash = LumaSyncAuth.sha256Hex(sb.toString().getBytes(StandardCharsets.UTF_8));
        return hash == null ? "" : hash;
    }

    private long enqueueEventInternal(SQLiteDatabase db, String dedupeKey, String epoch,
                                      String eventType, long completionId, int day,
                                      String payloadJson, String createdAt, String eventId) {
        ContentValues ev = new ContentValues();
        ev.put("event_id", eventId);
        ev.put("dedupe_key", dedupeKey);
        ev.put("source_epoch", epoch);
        ev.put("event_type", eventType);
        ev.put("completion_id", completionId);
        ev.put("day", day);
        ev.put("payload_json", payloadJson);
        ev.put("created_at", createdAt);
        ev.put("state", "PENDING");
        ev.put("attempts", 0);
        ev.put("next_retry_at", 0L);
        return db.insertWithOnConflict("outbox_events", null, ev, SQLiteDatabase.CONFLICT_IGNORE);
    }

    public EnqueueResult recordCompletion(String epoch, JSONObject rec) throws Exception {
        long completionId = rec.optLong("completionId", -1L);
        int day = rec.optInt("day", 0);
        if (completionId <= 0 || day <= 0) {
            throw new IllegalArgumentException("Invalid completion record");
        }
        String now = nowIso();
        String eventId = UUID.randomUUID().toString();
        String dedupeKey = "COMP:" + epoch + ":" + completionId;

        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            db.insertWithOnConflict("session_records", null, recordToValues(rec, epoch, now),
                    SQLiteDatabase.CONFLICT_REPLACE);
            long seq = enqueueEventInternal(db, dedupeKey, epoch,
                    LumaSyncContract.EVENT_SESSION_COMPLETED, completionId, day,
                    rec.toString(), now, eventId);
            String hash = recomputeSnapshotHash(db);
            putMeta(db, "source_epoch", epoch);
            putMeta(db, "snapshot_hash", hash);
            putMeta(db, "mirror_ready", "1");
            putMeta(db, "updated_at", now);
            db.setTransactionSuccessful();
            return new EnqueueResult(seq > 0, seq, eventId, hash);
        } finally {
            db.endTransaction();
        }
    }

    public int recordReopen(String epoch, String reopenedAt, JSONArray records) throws Exception {
        if (records == null || records.length() == 0) {
            return 0;
        }
        String now = nowIso();
        String effectiveReopenedAt = (reopenedAt == null || reopenedAt.isEmpty()) ? now : reopenedAt;
        int enqueuedCount = 0;

        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            for (int i = 0; i < records.length(); i++) {
                JSONObject rec = records.optJSONObject(i);
                if (rec == null) {
                    continue;
                }
                long completionId = rec.optLong("completionId", -1L);
                int day = rec.optInt("day", 0);
                if (completionId <= 0 || day <= 0) {
                    continue;
                }
                rec.put("reopenedAt", effectiveReopenedAt);
                rec.put("isActive", false);
                db.insertWithOnConflict("session_records", null, recordToValues(rec, epoch, now),
                        SQLiteDatabase.CONFLICT_REPLACE);
                String eventId = UUID.randomUUID().toString();
                String dedupeKey = "REOPEN:" + epoch + ":" + completionId + ":" + effectiveReopenedAt;
                long seq = enqueueEventInternal(db, dedupeKey, epoch,
                        LumaSyncContract.EVENT_SESSION_REOPENED, completionId, day,
                        rec.toString(), now, eventId);
                if (seq > 0) {
                    enqueuedCount++;
                }
            }
            String hash = recomputeSnapshotHash(db);
            putMeta(db, "source_epoch", epoch);
            putMeta(db, "snapshot_hash", hash);
            putMeta(db, "mirror_ready", "1");
            putMeta(db, "updated_at", now);
            db.setTransactionSuccessful();
            return enqueuedCount;
        } finally {
            db.endTransaction();
        }
    }

    public SnapshotResult syncSnapshot(String epoch, String reason, boolean forceReset, JSONArray records)
            throws Exception {
        String now = nowIso();
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            String prevEpoch = getMeta(db, "source_epoch", "");
            String prevHash = getMeta(db, "snapshot_hash", "");
            boolean wasReady = "1".equals(getMeta(db, "mirror_ready", "0"));
            boolean epochChanged = forceReset || (!prevEpoch.isEmpty() && !prevEpoch.equals(epoch));

            // Rebuild session_records inside the transaction, then compare deterministic hashes.
            db.delete("session_records", null, null);
            int total = 0;
            int active = 0;
            if (records != null) {
                for (int i = 0; i < records.length(); i++) {
                    JSONObject rec = records.optJSONObject(i);
                    if (rec == null) {
                        continue;
                    }
                    long completionId = rec.optLong("completionId", -1L);
                    int day = rec.optInt("day", 0);
                    if (completionId <= 0 || day <= 0) {
                        continue;
                    }
                    ContentValues cv = recordToValues(rec, epoch, now);
                    db.insertWithOnConflict("session_records", null, cv, SQLiteDatabase.CONFLICT_REPLACE);
                    total++;
                    if (cv.getAsInteger("is_active") == 1) {
                        active++;
                    }
                }
            }

            String newHash = recomputeSnapshotHash(db);
            boolean hashChanged = !newHash.equals(prevHash);
            boolean changed = !wasReady || epochChanged || hashChanged;

            if (epochChanged) {
                // Supersede any pending delta events from prior epochs so Luma cleanly recovers via /snapshot.
                ContentValues sup = new ContentValues();
                sup.put("state", "SUPERSEDED");
                sup.put("last_error", "superseded_by_epoch_reset");
                db.update("outbox_events", sup, "state = ? AND source_epoch != ?",
                        new String[]{"PENDING", epoch});

                JSONObject payload = new JSONObject();
                payload.put("reason", reason == null ? "backup-restore" : reason);
                payload.put("recordCount", total);
                payload.put("activeCount", active);
                payload.put("snapshotHash", newHash);
                enqueueEventInternal(db, "RESET:" + epoch, epoch,
                        LumaSyncContract.EVENT_SNAPSHOT_RESET, 0L, 0,
                        payload.toString(), now, UUID.randomUUID().toString());
            } else if (!wasReady || hashChanged) {
                JSONObject payload = new JSONObject();
                payload.put("reason", reason == null ? "initial-migration" : reason);
                payload.put("recordCount", total);
                payload.put("activeCount", active);
                payload.put("snapshotHash", newHash);
                enqueueEventInternal(db, "READY:" + epoch + ":" + newHash, epoch,
                        LumaSyncContract.EVENT_SNAPSHOT_READY, 0L, 0,
                        payload.toString(), now, UUID.randomUUID().toString());
            }

            putMeta(db, "source_epoch", epoch);
            putMeta(db, "snapshot_hash", newHash);
            putMeta(db, "mirror_ready", "1");
            putMeta(db, "updated_at", now);
            db.setTransactionSuccessful();
            return new SnapshotResult(changed, epochChanged, total, active, newHash);
        } finally {
            db.endTransaction();
        }
    }

    public List<OutboxEvent> fetchPendingEvents(int limit) {
        List<OutboxEvent> out = new ArrayList<>();
        SQLiteDatabase db = getReadableDatabase();
        Cursor c = db.query(
            "outbox_events",
            new String[]{"seq", "event_id", "source_epoch", "event_type", "completion_id",
                    "day", "payload_json", "created_at", "attempts", "next_retry_at"},
            "state = ?",
            new String[]{"PENDING"},
            null, null, "seq ASC",
            String.valueOf(Math.max(1, Math.min(limit, 200)))
        );
        try {
            while (c.moveToNext()) {
                out.add(new OutboxEvent(
                    c.getLong(0), c.getString(1), c.getString(2), c.getString(3),
                    c.getLong(4), c.getInt(5), c.getString(6), c.getString(7),
                    c.getInt(8), c.getLong(9)
                ));
            }
        } finally {
            c.close();
        }
        return out;
    }

    public void markEventAcked(long seq, String ackedAt) {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            ContentValues cv = new ContentValues();
            cv.put("state", "ACKED");
            cv.put("acked_at", ackedAt);
            cv.putNull("last_error");
            db.update("outbox_events", cv, "seq = ?", new String[]{String.valueOf(seq)});

            long prevAcked = 0L;
            try {
                prevAcked = Long.parseLong(getMeta(db, "last_acked_seq", "0"));
            } catch (NumberFormatException ignored) {}
            if (seq > prevAcked) {
                putMeta(db, "last_acked_seq", String.valueOf(seq));
            }
            putMeta(db, "last_sync_at", ackedAt);
            putMeta(db, "last_error", "");

            // Compact old ACKed rows beyond the retention window while preserving recent delta history.
            db.execSQL(
                "DELETE FROM outbox_events WHERE state IN ('ACKED', 'SUPERSEDED') AND seq NOT IN (" +
                "  SELECT seq FROM outbox_events WHERE state IN ('ACKED', 'SUPERSEDED') ORDER BY seq DESC LIMIT ?" +
                ")",
                new Object[]{ACKED_RETENTION_LIMIT}
            );
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
    }

    public void markEventRetry(long seq, int attempts, long nextRetryAtMs, String error) {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            ContentValues cv = new ContentValues();
            cv.put("attempts", attempts);
            cv.put("next_retry_at", nextRetryAtMs);
            cv.put("last_error", error == null ? "" : error);
            db.update("outbox_events", cv, "seq = ?", new String[]{String.valueOf(seq)});
            putMeta(db, "last_error", error == null ? "" : error);
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
    }

    public void enqueueSnapshotReadySignal(String reason) {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            String epoch = getMeta(db, "source_epoch", "");
            String hash = getMeta(db, "snapshot_hash", "");
            if (epoch.isEmpty()) {
                return;
            }
            String now = nowIso();
            JSONObject payload = new JSONObject();
            payload.put("reason", reason == null ? "full-sync-requested" : reason);
            payload.put("snapshotHash", hash);
            enqueueEventInternal(db, "SIGNAL:" + epoch + ":" + now, epoch,
                    LumaSyncContract.EVENT_SNAPSHOT_READY, 0L, 0,
                    payload.toString(), now, UUID.randomUUID().toString());
            db.setTransactionSuccessful();
        } catch (Exception ignored) {
            // Never disrupt normal operations
        } finally {
            db.endTransaction();
        }
    }

    public void recordLastError(String error) {
        SQLiteDatabase db = getWritableDatabase();
        putMeta(db, "last_error", error == null ? "" : error);
    }

    private long scalarLong(SQLiteDatabase db, String sql, String[] args) {
        Cursor c = db.rawQuery(sql, args);
        try {
            return c.moveToFirst() ? c.getLong(0) : 0L;
        } finally {
            c.close();
        }
    }

    public Cursor queryMetaCursor() {
        SQLiteDatabase db = getReadableDatabase();
        MatrixCursor mc = new MatrixCursor(new String[]{
            "schema_version", "source_app", "ready", "source_epoch",
            "latest_seq", "active_count", "total_records",
            "pending_outbox_count", "snapshot_hash", "updated_at"
        });
        int ready = "1".equals(getMeta(db, "mirror_ready", "0")) ? 1 : 0;
        String epoch = getMeta(db, "source_epoch", "");
        String hash = getMeta(db, "snapshot_hash", "");
        String updatedAt = getMeta(db, "updated_at", "");
        long latestSeq = scalarLong(db, "SELECT COALESCE(MAX(seq), 0) FROM outbox_events", null);
        long activeCount = scalarLong(db, "SELECT COUNT(*) FROM session_records WHERE is_active = 1", null);
        long totalRecords = scalarLong(db, "SELECT COUNT(*) FROM session_records", null);
        long pendingCount = scalarLong(db, "SELECT COUNT(*) FROM outbox_events WHERE state = ?", new String[]{"PENDING"});
        mc.addRow(new Object[]{
            LumaSyncContract.SCHEMA_VERSION,
            LumaSyncContract.BYTEWISE_PACKAGE,
            ready,
            epoch,
            latestSeq,
            activeCount,
            totalRecords,
            pendingCount,
            hash,
            updatedAt
        });
        return mc;
    }

    public Cursor queryEventsCursor(String epochFilter, long sinceSeq, int limit) {
        SQLiteDatabase db = getReadableDatabase();
        String currentEpoch = getMeta(db, "source_epoch", "");
        int clampedLimit = Math.max(1, Math.min(limit, 2000));
        long safeSince = Math.max(0L, sinceSeq);
        if (epochFilter != null && !epochFilter.isEmpty() && !epochFilter.equals(currentEpoch)) {
            return new MatrixCursor(new String[]{
                "seq", "event_id", "source_epoch", "event_type",
                "completion_id", "day", "payload_json", "created_at"
            });
        }
        return db.query(
            "outbox_events",
            new String[]{"seq", "event_id", "source_epoch", "event_type",
                    "completion_id", "day", "payload_json", "created_at"},
            "source_epoch = ? AND seq > ? AND state != ?",
            new String[]{currentEpoch, String.valueOf(safeSince), "SUPERSEDED"},
            null, null, "seq ASC",
            String.valueOf(clampedLimit)
        );
    }

    public Cursor querySnapshotCursor() {
        SQLiteDatabase db = getReadableDatabase();
        return db.query(
            "session_records",
            new String[]{
                "completion_id", "day", "session_id", "module_id", "module_name",
                "topic_id", "topic_name", "title", "phase",
                "completed_at", "local_date", "local_time",
                "reopened_at", "is_active", "source_epoch", "updated_at"
            },
            null, null, null, null, "completion_id ASC"
        );
    }

    public JSONObject getStatusJson() {
        JSONObject out = new JSONObject();
        SQLiteDatabase db = getReadableDatabase();
        try {
            out.put("ready", "1".equals(getMeta(db, "mirror_ready", "0")));
            out.put("sourceEpoch", getMeta(db, "source_epoch", ""));
            out.put("snapshotHash", getMeta(db, "snapshot_hash", ""));
            out.put("lastAckedSeq", Long.parseLong(getMeta(db, "last_acked_seq", "0")));
            out.put("lastSyncAt", getMeta(db, "last_sync_at", ""));
            out.put("lastError", getMeta(db, "last_error", ""));
            out.put("activeCount", scalarLong(db, "SELECT COUNT(*) FROM session_records WHERE is_active = 1", null));
            out.put("totalRecords", scalarLong(db, "SELECT COUNT(*) FROM session_records", null));
            out.put("pendingCount", scalarLong(db, "SELECT COUNT(*) FROM outbox_events WHERE state = ?", new String[]{"PENDING"}));
        } catch (Exception ignored) {}
        return out;
    }
}
'''

JAVA["LumaSyncDispatcher.java"] = r'''package PKG;

import android.content.Context;
import android.os.Bundle;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Serial offline event dispatcher with capped exponential backoff retries and ACK tracking.
 * Never throws uncaught exceptions or blocks Bytewise UI threads.
 */
public final class LumaSyncDispatcher {
    private static final long[] BACKOFF_MS = new long[]{
        5_000L, 30_000L, 120_000L, 600_000L, 1_800_000L
    };

    private static final ScheduledExecutorService EXECUTOR = Executors.newSingleThreadScheduledExecutor(
        new ThreadFactory() {
            @Override
            public Thread newThread(Runnable r) {
                Thread t = new Thread(r, "bytewise-luma-sync");
                t.setDaemon(true);
                return t;
            }
        }
    );

    private static final AtomicBoolean FLUSH_RUNNING = new AtomicBoolean(false);
    private static volatile ScheduledFuture<?> pendingRetryTask;

    private LumaSyncDispatcher() {}

    public static void execute(Runnable task) {
        EXECUTOR.execute(task);
    }

    public static void flushAsync(final Context context, final boolean forceImmediate) {
        if (context == null) {
            return;
        }
        final Context appCtx = context.getApplicationContext();
        EXECUTOR.execute(new Runnable() {
            @Override
            public void run() {
                flushInternal(appCtx, forceImmediate);
            }
        });
    }

    private static void scheduleDelayedFlush(final Context appCtx, long delayMs) {
        long clamped = Math.max(1_000L, delayMs);
        ScheduledFuture<?> prev = pendingRetryTask;
        if (prev != null && !prev.isDone()) {
            prev.cancel(false);
        }
        pendingRetryTask = EXECUTOR.schedule(new Runnable() {
            @Override
            public void run() {
                flushInternal(appCtx, false);
            }
        }, clamped, TimeUnit.MILLISECONDS);
    }

    private static void flushInternal(Context appCtx, boolean forceImmediate) {
        if (!FLUSH_RUNNING.compareAndSet(false, true)) {
            return;
        }
        try {
            LumaSyncDbHelper db = LumaSyncDbHelper.getInstance(appCtx);
            List<LumaSyncDbHelper.OutboxEvent> pending = db.fetchPendingEvents(50);
            if (pending.isEmpty()) {
                return;
            }
            if (!LumaSyncAuth.isTrustedPeerInstalled(appCtx)) {
                db.recordLastError("luma_not_installed_or_untrusted");
                return;
            }

            long nowMs = System.currentTimeMillis();
            if (!forceImmediate) {
                LumaSyncDbHelper.OutboxEvent head = pending.get(0);
                if (head.nextRetryAt > nowMs) {
                    scheduleDelayedFlush(appCtx, head.nextRetryAt - nowMs);
                    return;
                }
            }

            for (LumaSyncDbHelper.OutboxEvent ev : pending) {
                if (!forceImmediate && ev.nextRetryAt > System.currentTimeMillis()) {
                    scheduleDelayedFlush(appCtx, ev.nextRetryAt - System.currentTimeMillis());
                    break;
                }
                Bundle extras = new Bundle();
                extras.putInt(LumaSyncContract.KEY_SCHEMA_VERSION, LumaSyncContract.SCHEMA_VERSION);
                extras.putString(LumaSyncContract.KEY_SOURCE_APP, LumaSyncContract.BYTEWISE_PACKAGE);
                extras.putString(LumaSyncContract.KEY_SOURCE_EPOCH, ev.sourceEpoch);
                extras.putString(LumaSyncContract.KEY_EVENT_ID, ev.eventId);
                extras.putLong(LumaSyncContract.KEY_SEQ, ev.seq);
                extras.putString(LumaSyncContract.KEY_EVENT_TYPE, ev.eventType);
                extras.putString(LumaSyncContract.KEY_CREATED_AT, ev.createdAt);
                extras.putString(LumaSyncContract.KEY_PAYLOAD_JSON, ev.payloadJson);

                try {
                    Bundle resp = appCtx.getContentResolver().call(
                        LumaSyncContract.LUMA_INGEST_URI,
                        LumaSyncContract.METHOD_INGEST_EVENT,
                        null,
                        extras
                    );
                    if (resp == null) {
                        handleFailure(appCtx, db, ev, "null_binder_response");
                        break;
                    }
                    String status = resp.getString(LumaSyncContract.KEY_STATUS, "");
                    if (LumaSyncContract.ACK_OK.equals(status) || LumaSyncContract.ACK_DUPLICATE.equals(status)) {
                        db.markEventAcked(ev.seq, LumaSyncDbHelper.nowIso());
                    } else if (LumaSyncContract.ACK_NEED_FULL_SYNC.equals(status)) {
                        db.markEventAcked(ev.seq, LumaSyncDbHelper.nowIso());
                        if (!LumaSyncContract.EVENT_SNAPSHOT_READY.equals(ev.eventType)
                                && !LumaSyncContract.EVENT_SNAPSHOT_RESET.equals(ev.eventType)) {
                            db.enqueueSnapshotReadySignal("luma-requested-full-sync");
                        }
                        break;
                    } else {
                        String reason = resp.getString(LumaSyncContract.KEY_REASON, status.isEmpty() ? "unknown_status" : status);
                        handleFailure(appCtx, db, ev, "rejected:" + reason);
                        break;
                    }
                } catch (SecurityException sec) {
                    handleFailure(appCtx, db, ev, "auth_rejected");
                    break;
                } catch (IllegalArgumentException arg) {
                    handleFailure(appCtx, db, ev, "provider_unavailable");
                    break;
                } catch (Exception ex) {
                    handleFailure(appCtx, db, ev, ex.getClass().getSimpleName());
                    break;
                }
            }
        } catch (Exception ignored) {
            // Sync must never interrupt Bytewise
        } finally {
            FLUSH_RUNNING.set(false);
        }
    }

    private static void handleFailure(Context appCtx, LumaSyncDbHelper db,
                                      LumaSyncDbHelper.OutboxEvent ev, String error) {
        int nextAttempt = ev.attempts + 1;
        long delay = BACKOFF_MS[Math.min(nextAttempt - 1, BACKOFF_MS.length - 1)];
        long nextRetryAt = System.currentTimeMillis() + delay;
        db.markEventRetry(ev.seq, nextAttempt, nextRetryAt, error);
        scheduleDelayedFlush(appCtx, delay);
    }
}
'''

JAVA["LumaSyncPlugin.java"] = r'''package PKG;

import android.content.Context;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Capacitor native bridge plugin registered as "LumaSyncBridge".
 * All methods execute off the main thread and resolve cleanly so Bytewise UI is never interrupted.
 */
@CapacitorPlugin(name = "LumaSyncBridge")
public class LumaSyncPlugin extends Plugin {

    @PluginMethod
    public void recordCompletion(final PluginCall call) {
        final Context ctx = getContext().getApplicationContext();
        final String epoch = call.getString("epoch", "");
        final JSObject recordObj = call.getObject("record");
        if (epoch == null || epoch.isEmpty() || recordObj == null) {
            JSObject err = new JSObject();
            err.put("ok", false);
            err.put("error", "invalid_args");
            call.resolve(err);
            return;
        }
        final String rawJson = recordObj.toString();
        LumaSyncDispatcher.execute(new Runnable() {
            @Override
            public void run() {
                JSObject out = new JSObject();
                try {
                    LumaSyncDbHelper db = LumaSyncDbHelper.getInstance(ctx);
                    LumaSyncDbHelper.EnqueueResult res = db.recordCompletion(epoch, new JSONObject(rawJson));
                    LumaSyncDispatcher.flushAsync(ctx, true);
                    out.put("ok", true);
                    out.put("enqueued", res.enqueued);
                    out.put("seq", res.seq);
                    out.put("eventId", res.eventId);
                    out.put("snapshotHash", res.snapshotHash);
                } catch (Exception ex) {
                    out.put("ok", false);
                    out.put("error", ex.getClass().getSimpleName());
                }
                call.resolve(out);
            }
        });
    }

    @PluginMethod
    public void recordReopen(final PluginCall call) {
        final Context ctx = getContext().getApplicationContext();
        final String epoch = call.getString("epoch", "");
        final String reopenedAt = call.getString("reopenedAt", "");
        final JSArray recordsArr = call.getArray("records");
        if (epoch == null || epoch.isEmpty() || recordsArr == null) {
            JSObject err = new JSObject();
            err.put("ok", false);
            err.put("error", "invalid_args");
            call.resolve(err);
            return;
        }
        final String rawJson = recordsArr.toString();
        LumaSyncDispatcher.execute(new Runnable() {
            @Override
            public void run() {
                JSObject out = new JSObject();
                try {
                    LumaSyncDbHelper db = LumaSyncDbHelper.getInstance(ctx);
                    int count = db.recordReopen(epoch, reopenedAt, new JSONArray(rawJson));
                    LumaSyncDispatcher.flushAsync(ctx, true);
                    out.put("ok", true);
                    out.put("enqueuedCount", count);
                } catch (Exception ex) {
                    out.put("ok", false);
                    out.put("error", ex.getClass().getSimpleName());
                }
                call.resolve(out);
            }
        });
    }

    @PluginMethod
    public void syncSnapshot(final PluginCall call) {
        final Context ctx = getContext().getApplicationContext();
        final String epoch = call.getString("epoch", "");
        final String reason = call.getString("reason", "boot-reconcile");
        final Boolean resetVal = call.getBoolean("reset", false);
        final boolean reset = resetVal != null && resetVal;
        final JSArray recordsArr = call.getArray("records");
        if (epoch == null || epoch.isEmpty()) {
            JSObject err = new JSObject();
            err.put("ok", false);
            err.put("error", "missing_epoch");
            call.resolve(err);
            return;
        }
        final String rawJson = recordsArr == null ? "[]" : recordsArr.toString();
        LumaSyncDispatcher.execute(new Runnable() {
            @Override
            public void run() {
                JSObject out = new JSObject();
                try {
                    LumaSyncDbHelper db = LumaSyncDbHelper.getInstance(ctx);
                    LumaSyncDbHelper.SnapshotResult res = db.syncSnapshot(epoch, reason, reset, new JSONArray(rawJson));
                    LumaSyncDispatcher.flushAsync(ctx, true);
                    out.put("ok", true);
                    out.put("changed", res.changed);
                    out.put("epochChanged", res.epochChanged);
                    out.put("recordCount", res.recordCount);
                    out.put("activeCount", res.activeCount);
                    out.put("snapshotHash", res.snapshotHash);
                } catch (Exception ex) {
                    out.put("ok", false);
                    out.put("error", ex.getClass().getSimpleName());
                }
                call.resolve(out);
            }
        });
    }

    @PluginMethod
    public void flushPending(final PluginCall call) {
        final Context ctx = getContext().getApplicationContext();
        final Boolean forceVal = call.getBoolean("force", true);
        final boolean force = forceVal == null || forceVal;
        LumaSyncDispatcher.flushAsync(ctx, force);
        JSObject out = new JSObject();
        out.put("ok", true);
        call.resolve(out);
    }

    @PluginMethod
    public void getStatus(final PluginCall call) {
        final Context ctx = getContext().getApplicationContext();
        LumaSyncDispatcher.execute(new Runnable() {
            @Override
            public void run() {
                JSObject out = new JSObject();
                try {
                    LumaSyncDbHelper db = LumaSyncDbHelper.getInstance(ctx);
                    JSONObject st = db.getStatusJson();
                    out = JSObject.fromJSONObject(st);
                    out.put("ok", true);
                    out.put("peerTrusted", LumaSyncAuth.isTrustedPeerInstalled(ctx));
                } catch (Exception ex) {
                    out.put("ok", false);
                    out.put("error", ex.getClass().getSimpleName());
                }
                call.resolve(out);
            }
        });
    }
}
'''

JAVA["BytewiseSyncProvider.java"] = r'''package PKG;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.UriMatcher;
import android.database.Cursor;
import android.net.Uri;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

/**
 * Strictly read-only ContentProvider exposing Bytewise completion history and delta events to Luma.
 * Protected by:
 *   1) Android signature-level permission (BYTEWISE_SYNC_READ)
 *   2) Runtime Binder UID + package name + SHA-256 signing certificate verification
 */
public class BytewiseSyncProvider extends ContentProvider {
    private static final int CODE_META = 1;
    private static final int CODE_EVENTS = 2;
    private static final int CODE_SNAPSHOT = 3;

    private static final UriMatcher MATCHER = new UriMatcher(UriMatcher.NO_MATCH);
    static {
        MATCHER.addURI(LumaSyncContract.BYTEWISE_AUTHORITY, LumaSyncContract.PATH_META, CODE_META);
        MATCHER.addURI(LumaSyncContract.BYTEWISE_AUTHORITY, LumaSyncContract.PATH_EVENTS, CODE_EVENTS);
        MATCHER.addURI(LumaSyncContract.BYTEWISE_AUTHORITY, LumaSyncContract.PATH_SNAPSHOT, CODE_SNAPSHOT);
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Nullable
    @Override
    public Cursor query(@NonNull Uri uri, @Nullable String[] projection, @Nullable String selection,
                        @Nullable String[] selectionArgs, @Nullable String sortOrder) {
        LumaSyncAuth.enforceTrustedCaller(getContext());
        LumaSyncDbHelper db = LumaSyncDbHelper.getInstance(getContext());
        switch (MATCHER.match(uri)) {
            case CODE_META:
                return db.queryMetaCursor();
            case CODE_EVENTS: {
                long sinceSeq = parseLongParam(uri.getQueryParameter("sinceSeq"), 0L);
                int limit = (int) parseLongParam(uri.getQueryParameter("limit"), 500L);
                String epoch = uri.getQueryParameter("epoch");
                return db.queryEventsCursor(epoch, sinceSeq, limit);
            }
            case CODE_SNAPSHOT:
                return db.querySnapshotCursor();
            default:
                throw new IllegalArgumentException("Unsupported URI: " + uri);
        }
    }

    @Nullable
    @Override
    public String getType(@NonNull Uri uri) {
        LumaSyncAuth.enforceTrustedCaller(getContext());
        switch (MATCHER.match(uri)) {
            case CODE_META:
                return "vnd.android.cursor.item/vnd." + LumaSyncContract.BYTEWISE_AUTHORITY + ".meta";
            case CODE_EVENTS:
                return "vnd.android.cursor.dir/vnd." + LumaSyncContract.BYTEWISE_AUTHORITY + ".events";
            case CODE_SNAPSHOT:
                return "vnd.android.cursor.dir/vnd." + LumaSyncContract.BYTEWISE_AUTHORITY + ".snapshot";
            default:
                throw new IllegalArgumentException("Unsupported URI: " + uri);
        }
    }

    @Nullable
    @Override
    public Uri insert(@NonNull Uri uri, @Nullable ContentValues values) {
        LumaSyncAuth.enforceTrustedCaller(getContext());
        throw new UnsupportedOperationException("BytewiseSyncProvider is read-only");
    }

    @Override
    public int bulkInsert(@NonNull Uri uri, @NonNull ContentValues[] values) {
        LumaSyncAuth.enforceTrustedCaller(getContext());
        throw new UnsupportedOperationException("BytewiseSyncProvider is read-only");
    }

    @Override
    public int delete(@NonNull Uri uri, @Nullable String selection, @Nullable String[] selectionArgs) {
        LumaSyncAuth.enforceTrustedCaller(getContext());
        throw new UnsupportedOperationException("BytewiseSyncProvider is read-only");
    }

    @Override
    public int update(@NonNull Uri uri, @Nullable ContentValues values,
                      @Nullable String selection, @Nullable String[] selectionArgs) {
        LumaSyncAuth.enforceTrustedCaller(getContext());
        throw new UnsupportedOperationException("BytewiseSyncProvider is read-only");
    }

    private static long parseLongParam(@Nullable String raw, long fallback) {
        if (raw == null || raw.isEmpty()) {
            return fallback;
        }
        try {
            return Long.parseLong(raw.trim());
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }
}
'''

# 1. Write all Java classes
for name, src in JAVA.items():
    content = src.replace("LUMA_PKG", LUMA_PKG).replace("PKG", PKG)
    write(os.path.join(java_dir, name), content)

# 2. Idempotently patch MainActivity.java to register LumaSyncPlugin and flush outbox onResume
main_activity_path = os.path.join(java_dir, "MainActivity.java")
if not os.path.isfile(main_activity_path):
    sys.exit("add_luma_sync: MainActivity.java not found at " + main_activity_path)

ma_text = open(main_activity_path, encoding="utf-8").read()
ma_changed = False

if "registerPlugin(LumaSyncPlugin.class);" not in ma_text:
    if "registerPlugin(WidgetBridgePlugin.class);" in ma_text:
        ma_text = ma_text.replace(
            "registerPlugin(WidgetBridgePlugin.class);",
            "registerPlugin(WidgetBridgePlugin.class);\n        registerPlugin(LumaSyncPlugin.class);",
            1,
        )
    elif "super.onCreate(savedInstanceState);" in ma_text:
        ma_text = ma_text.replace(
            "super.onCreate(savedInstanceState);",
            "registerPlugin(LumaSyncPlugin.class);\n        super.onCreate(savedInstanceState);",
            1,
        )
    else:
        sys.exit("add_luma_sync: Could not locate plugin registration point in MainActivity.java")
    ma_changed = True

if "LumaSyncDispatcher.flushAsync(" not in ma_text:
    on_resume_block = (
        "\n    @Override\n"
        "    public void onResume() {\n"
        "        super.onResume();\n"
        "        LumaSyncDispatcher.flushAsync(this, true);\n"
        "    }\n"
    )
    last_brace = ma_text.rfind("}")
    if last_brace == -1:
        sys.exit("add_luma_sync: Invalid MainActivity.java structure")
    ma_text = ma_text[:last_brace] + on_resume_block + ma_text[last_brace:]
    ma_changed = True

if ma_changed:
    write(main_activity_path, ma_text)
else:
    print("MainActivity.java already patched for LumaSync")

# 3. Idempotently patch AndroidManifest.xml
manifest = open(manifest_path, encoding="utf-8").read()
manifest_changed = False

perm_read = PKG + ".permission.BYTEWISE_SYNC_READ"
perm_ingest = LUMA_PKG + ".permission.LUMA_SYNC_INGEST"
authority = PKG + ".lumasync"
luma_authority = LUMA_PKG + ".bytewiseingest"

TOP_LEVEL_BLOCK = f'''
    <!-- Bytewise -> Luma offline local synchronization (signature-level trust) -->
    <permission
        android:name="{perm_read}"
        android:protectionLevel="signature" />
    <uses-permission android:name="{perm_ingest}" />
    <queries>
        <package android:name="{LUMA_PKG}" />
        <provider android:authorities="{luma_authority}" />
    </queries>
'''

PROVIDER_BLOCK = f'''
        <provider
            android:name="{PKG}.BytewiseSyncProvider"
            android:authorities="{authority}"
            android:exported="true"
            android:grantUriPermissions="false"
            android:readPermission="{perm_read}" />
'''

if perm_read not in manifest:
    if "<application" not in manifest:
        sys.exit("add_luma_sync: <application> not found in AndroidManifest.xml")
    manifest = manifest.replace("<application", TOP_LEVEL_BLOCK.lstrip("\n") + "    <application", 1)
    manifest_changed = True

if "BytewiseSyncProvider" not in manifest:
    if "</application>" not in manifest:
        sys.exit("add_luma_sync: </application> not found in AndroidManifest.xml")
    manifest = manifest.replace("</application>", PROVIDER_BLOCK + "    </application>", 1)
    manifest_changed = True

if manifest_changed:
    write(manifest_path, manifest)
else:
    print("AndroidManifest.xml already patched for LumaSync")

print("Luma sync bridge added for Bytewise (" + PKG + ") -> Luma (" + LUMA_PKG + ")")
