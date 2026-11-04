#!/usr/bin/env python3
"""Adds the home-screen widgets and the WidgetBridge plugin to the generated Capacitor Android project.
Run from the repo root AFTER `npx cap add android` (the GitHub workflow does this). Uses only the Python standard library.
Safe to run twice. Stops with a clear message if the Android project is not what it expects."""
import json, os, re, sys

root = os.getcwd()
cfg = json.load(open('capacitor.config.json'))
PKG = cfg['appId']
app = os.path.join('android', 'app', 'src', 'main')
java_dir = os.path.join(app, 'java', *PKG.split('.'))
res = os.path.join(app, 'res')
if not os.path.isdir(java_dir):
    sys.exit('add_widgets: Android project not found at ' + java_dir)

def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
    print('wrote', path)

JAVA = {}

JAVA['MainActivity.java'] = '''package PKG;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static String pendingRoute = "";

    public static synchronized String takeRoute() {
        String r = pendingRoute;
        pendingRoute = "";
        return r;
    }

    private static synchronized void remember(Intent intent) {
        if (intent != null && intent.hasExtra("route")) {
            String r = intent.getStringExtra("route");
            pendingRoute = (r == null) ? "" : r;
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridgePlugin.class);
        super.onCreate(savedInstanceState);
        if (savedInstanceState == null) {
            remember(getIntent());
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        remember(intent);
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().evaluateJavascript("window.dispatchEvent(new Event('cse-native-route'))", null);
        }
    }
}
'''

JAVA['WidgetBridgePlugin.java'] = '''package PKG;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    private static int intOf(PluginCall call, String key) {
        Integer v = call.getInt(key, 0);
        return v == null ? 0 : v;
    }

    private static String textOf(PluginCall call, String key) {
        String v = call.getString(key, "");
        return v == null ? "" : v;
    }

    @PluginMethod
    public void update(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences.Editor e = ctx.getSharedPreferences(WidgetRenderer.PREFS, Context.MODE_PRIVATE).edit();
        e.putBoolean("synced", true);
        e.putInt("total", intOf(call, "total"));
        e.putInt("done", intOf(call, "done"));
        e.putInt("skipped", intOf(call, "skipped"));
        e.putInt("nextDay", intOf(call, "nextDay"));
        e.putString("title", textOf(call, "title"));
        e.putString("module", textOf(call, "module"));
        e.putString("time", textOf(call, "time"));
        e.putString("status", textOf(call, "status"));
        e.putString("phase", textOf(call, "phase"));
        e.putString("statusLabel", textOf(call, "statusLabel"));
        JSObject colors = call.getObject("colors");
        if (colors != null) {
            String[] keys = {"card", "ink", "muted", "pill", "done", "doneInk", "prev", "prevInk", "info", "infoInk", "next", "nextInk"};
            for (String k : keys) {
                String v = colors.getString(k);
                if (v != null && v.matches("#[0-9A-Fa-f]{6}")) e.putString("c_" + k, v);
            }
        }
        e.apply();
        WidgetRenderer.updateAll(ctx);
        call.resolve();
    }

    @PluginMethod
    public void getLaunchRoute(PluginCall call) {
        JSObject r = new JSObject();
        r.put("route", MainActivity.takeRoute());
        call.resolve(r);
    }
}
'''

JAVA['WidgetRenderer.java'] = '''package PKG;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.view.View;
import android.widget.RemoteViews;
import java.util.Locale;

public final class WidgetRenderer {
    static final String PREFS = "cse_widget";
    private WidgetRenderer() {}

    public static void updateAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, NextSessionWidget.class));
        for (int id : ids) mgr.updateAppWidget(id, buildNext(ctx));
        int[] progressIds = mgr.getAppWidgetIds(new ComponentName(ctx, ProgressWidget.class));
        for (int id : progressIds) mgr.updateAppWidget(id, buildProgress(ctx));
    }

    private static PendingIntent open(Context ctx, String route, int code) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        i.putExtra("route", route);
        return PendingIntent.getActivity(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    private static String n(int v) { return String.format(Locale.US, "%,d", v); }

    private static int col(SharedPreferences sp, String key, String fallback) {
        String v = sp.getString("c_" + key, fallback);
        try { return Color.parseColor(v); } catch (Exception ex) { return Color.parseColor(fallback); }
    }
    private static void tint(RemoteViews rv, int viewId, int color) { rv.setInt(viewId, "setColorFilter", color); }

    // The widget is the Home card: phase, module pill, symbol, title, day, time, status, Done and Previous / Info / Next.
    // Colours are copied from the palette chosen in the app (sent by the web side); the defaults below are only used before the first sync.
    public static RemoteViews buildNext(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_next);
        boolean synced = sp.getBoolean("synced", false);
        int total = sp.getInt("total", 0), day = sp.getInt("nextDay", 0), done = sp.getInt("done", 0);
        String phase, module, title, dayText, time, status;
        if (!synced) {
            phase = "Bytewise"; module = "Open the app once"; title = "Your next session appears here"; dayText = ""; time = ""; status = "";
            day = 1;
        } else if (day <= 0) {
            phase = "Bytewise"; module = "Roadmap complete"; title = "All sessions are completed or skipped"; dayText = n(done) + " of " + n(total) + " done"; time = ""; status = "";
            day = Math.max(1, total);
        } else {
            phase = sp.getString("phase", ""); module = sp.getString("module", ""); title = sp.getString("title", "");
            dayText = "Day " + n(day) + " of " + n(total);
            time = sp.getString("time", ""); status = sp.getString("statusLabel", "");
        }
        rv.setTextViewText(R.id.w_phase, phase);
        rv.setTextViewText(R.id.w_module, "</>  " + module);
        rv.setTextViewText(R.id.w_symbol, "\u2726");
        rv.setTextViewText(R.id.w_title, title);
        rv.setTextViewText(R.id.w_day, dayText);
        rv.setTextViewText(R.id.w_time, time.isEmpty() ? "" : "\u25F7  " + time);
        rv.setTextViewText(R.id.w_status, status);
        rv.setViewVisibility(R.id.w_status_bg, status.isEmpty() ? View.GONE : View.VISIBLE);
        rv.setViewVisibility(R.id.w_status, status.isEmpty() ? View.GONE : View.VISIBLE);

        int card = col(sp, "card", "#D5F7A0"), ink = col(sp, "ink", "#0D0D10"), muted = col(sp, "muted", "#5C6650");
        int pill = col(sp, "pill", "#B9DC8C"), doneC = col(sp, "done", "#E9FBC9"), doneInk = col(sp, "doneInk", "#0D0D10");
        int prevC = col(sp, "prev", "#A9B29A"), prevInk = col(sp, "prevInk", "#0D0D10");
        int infoC = col(sp, "info", "#CDB8F5"), infoInk = col(sp, "infoInk", "#0D0D10");
        int nextC = col(sp, "next", "#17171C"), nextInk = col(sp, "nextInk", "#FFFFFF");
        tint(rv, R.id.w_card_bg, card);
        tint(rv, R.id.w_module_bg, pill); tint(rv, R.id.w_status_bg, pill);
        tint(rv, R.id.w_done_bg, doneC); tint(rv, R.id.w_prev_bg, prevC); tint(rv, R.id.w_info_bg, infoC); tint(rv, R.id.w_next_bg, nextC);
        rv.setTextColor(R.id.w_phase, muted); rv.setTextColor(R.id.w_module, ink); rv.setTextColor(R.id.w_symbol, ink);
        rv.setTextColor(R.id.w_title, ink); rv.setTextColor(R.id.w_day, muted); rv.setTextColor(R.id.w_time, muted); rv.setTextColor(R.id.w_status, ink);
        rv.setTextColor(R.id.w_done, doneInk); rv.setTextColor(R.id.w_prev, prevInk); rv.setTextColor(R.id.w_info, infoInk); rv.setTextColor(R.id.w_next, nextInk);

        int prev = Math.max(1, day - 1), next = Math.min(Math.max(1, total), day + 1);
        rv.setOnClickPendingIntent(R.id.widget_root, open(ctx, "#today/" + day, 101));
        rv.setOnClickPendingIntent(R.id.w_prev, open(ctx, "#today/" + prev, 102));
        rv.setOnClickPendingIntent(R.id.w_done, open(ctx, "#widget-done/" + day, 103));
        rv.setOnClickPendingIntent(R.id.w_info, open(ctx, "#widget-info/" + day, 105));
        rv.setOnClickPendingIntent(R.id.w_next, open(ctx, "#today/" + next, 104));
        return rv;
    }

    public static RemoteViews buildProgress(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_progress);
        boolean synced = sp.getBoolean("synced", false);
        int total = sp.getInt("total", 0), done = sp.getInt("done", 0), skipped = sp.getInt("skipped", 0);
        rv.setTextViewText(R.id.widget_label, "BYTEWISE PROGRESS");
        if (!synced || total <= 0) {
            rv.setTextViewText(R.id.widget_big, "Open the app once");
            rv.setTextViewText(R.id.widget_sub, "Progress appears here after the app has opened.");
            rv.setProgressBar(R.id.widget_bar, 100, 0, false);
        } else {
            int pct = (int)Math.floor(done * 100.0 / total);
            rv.setTextViewText(R.id.widget_big, n(done) + " / " + n(total));
            String sub = n(total - done) + " remaining  ·  " + pct + "% complete";
            if (skipped > 0) sub += "  ·  " + skipped + " skipped";
            rv.setTextViewText(R.id.widget_sub, sub);
            rv.setProgressBar(R.id.widget_bar, 100, pct, false);
        }
        rv.setOnClickPendingIntent(R.id.widget_root, open(ctx, "#progress", 2));
        return rv;
    }
}
'''

JAVA['NextSessionWidget.java'] = '''package PKG;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

public class NextSessionWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            appWidgetManager.updateAppWidget(id, WidgetRenderer.buildNext(context));
        }
    }
}
'''

JAVA['ProgressWidget.java'] = '''package PKG;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

public class ProgressWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            appWidgetManager.updateAppWidget(id, WidgetRenderer.buildProgress(context));
        }
    }
}
'''

TV = 'android:layout_width="match_parent" android:layout_height="wrap_content"'
LAYOUT_NEXT = '''<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

    <ImageView android:id="@+id/w_card_bg" android:layout_width="match_parent" android:layout_height="match_parent"
        android:scaleType="fitXY" android:src="@drawable/widget_shape_card" />

    <LinearLayout android:layout_width="match_parent" android:layout_height="match_parent"
        android:gravity="center_horizontal" android:orientation="vertical" android:padding="14dp">

        <TextView android:id="@+id/w_phase" android:layout_width="match_parent" android:layout_height="wrap_content"
            android:ellipsize="end" android:gravity="center" android:maxLines="1" android:textSize="12sp" />

        <FrameLayout android:layout_width="match_parent" android:layout_height="34dp" android:layout_marginTop="6dp">
            <ImageView android:id="@+id/w_module_bg" android:layout_width="match_parent" android:layout_height="match_parent"
                android:scaleType="fitXY" android:src="@drawable/widget_shape_pill" />
            <TextView android:id="@+id/w_module" android:layout_width="match_parent" android:layout_height="match_parent"
                android:ellipsize="end" android:gravity="center_vertical" android:maxLines="1"
                android:paddingStart="14dp" android:paddingEnd="14dp" android:textSize="13sp" android:textStyle="bold" />
        </FrameLayout>

        <TextView android:id="@+id/w_symbol" android:layout_width="wrap_content" android:layout_height="wrap_content"
            android:layout_marginTop="4dp" android:textSize="26sp" />

        <TextView android:id="@+id/w_title" android:layout_width="match_parent" android:layout_height="wrap_content"
            android:ellipsize="end" android:gravity="center" android:maxLines="3" android:textSize="20sp" android:textStyle="bold" />

        <TextView android:id="@+id/w_day" android:layout_width="match_parent" android:layout_height="wrap_content"
            android:layout_marginTop="4dp" android:gravity="center" android:maxLines="1" android:textSize="14sp" />
        <TextView android:id="@+id/w_time" android:layout_width="match_parent" android:layout_height="wrap_content"
            android:gravity="center" android:maxLines="1" android:textSize="13sp" />

        <FrameLayout android:layout_width="match_parent" android:layout_height="32dp" android:layout_marginTop="6dp">
            <ImageView android:id="@+id/w_status_bg" android:layout_width="match_parent" android:layout_height="match_parent"
                android:scaleType="fitXY" android:src="@drawable/widget_shape_pill" />
            <TextView android:id="@+id/w_status" android:layout_width="match_parent" android:layout_height="match_parent"
                android:gravity="center" android:maxLines="1" android:textSize="13sp" />
        </FrameLayout>

        <FrameLayout android:layout_width="match_parent" android:layout_height="44dp" android:layout_marginTop="8dp">
            <ImageView android:id="@+id/w_done_bg" android:layout_width="match_parent" android:layout_height="match_parent"
                android:scaleType="fitXY" android:src="@drawable/widget_shape_btn" />
            <TextView android:id="@+id/w_done" android:layout_width="match_parent" android:layout_height="match_parent"
                android:gravity="center" android:text="\u2713  Done" android:textSize="15sp" android:textStyle="bold" />
        </FrameLayout>

        <LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content"
            android:layout_marginTop="6dp" android:orientation="horizontal">
        <FrameLayout android:layout_width="0dp" android:layout_height="42dp" android:layout_weight="1">
            <ImageView android:id="@+id/w_prev_bg" android:layout_width="match_parent" android:layout_height="match_parent" android:scaleType="fitXY" android:src="@drawable/widget_shape_btn" />
            <TextView android:id="@+id/w_prev" android:layout_width="match_parent" android:layout_height="match_parent" android:gravity="center" android:maxLines="1" android:text="\u2039  Previous" android:textSize="13sp" android:textStyle="bold" />
        </FrameLayout>
        <FrameLayout android:layout_width="0dp" android:layout_height="42dp" android:layout_weight="1" android:layout_marginStart="6dp">
            <ImageView android:id="@+id/w_info_bg" android:layout_width="match_parent" android:layout_height="match_parent" android:scaleType="fitXY" android:src="@drawable/widget_shape_btn" />
            <TextView android:id="@+id/w_info" android:layout_width="match_parent" android:layout_height="match_parent" android:gravity="center" android:maxLines="1" android:text="\u24D8  Info" android:textSize="13sp" android:textStyle="bold" />
        </FrameLayout>
        <FrameLayout android:layout_width="0dp" android:layout_height="42dp" android:layout_weight="1" android:layout_marginStart="6dp">
            <ImageView android:id="@+id/w_next_bg" android:layout_width="match_parent" android:layout_height="match_parent" android:scaleType="fitXY" android:src="@drawable/widget_shape_btn" />
            <TextView android:id="@+id/w_next" android:layout_width="match_parent" android:layout_height="match_parent" android:gravity="center" android:maxLines="1" android:text="Next  \u203A" android:textSize="13sp" android:textStyle="bold" />
        </FrameLayout>
        </LinearLayout>
    </LinearLayout>
</FrameLayout>
'''

LAYOUT_PROGRESS = '''<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/widget_bg"
    android:gravity="center_vertical"
    android:orientation="vertical"
    android:padding="14dp">

    <TextView
        android:id="@+id/widget_label"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:maxLines="1"
        android:text="CURRICULUM PROGRESS"
        android:textColor="@color/widget_accent"
        android:textSize="11sp"
        android:textStyle="bold" />

    <TextView
        android:id="@+id/widget_big"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="2dp"
        android:maxLines="1"
        android:textColor="@color/widget_ink"
        android:textSize="22sp"
        android:textStyle="bold" />

    <ProgressBar
        android:id="@+id/widget_bar"
        style="?android:attr/progressBarStyleHorizontal"
        android:layout_width="match_parent"
        android:layout_height="8dp"
        android:layout_marginTop="8dp"
        android:max="100"
        android:progress="0"
        android:progressBackgroundTint="@color/widget_track"
        android:progressTint="@color/widget_accent" />

    <TextView
        android:id="@+id/widget_sub"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="8dp"
        android:ellipsize="end"
        android:maxLines="2"
        android:textColor="@color/widget_muted"
        android:textSize="12sp" />
</LinearLayout>
'''

def provider(layout, w, h):
    return '''<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:initialLayout="@layout/%s"
    android:minWidth="%ddp"
    android:minHeight="%ddp"
    android:resizeMode="horizontal|vertical"
    android:updatePeriodMillis="1800000"
    android:widgetCategory="home_screen" />
''' % (layout, w, h)

BG = '''<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="@color/widget_bg" />
    <corners android:radius="20dp" />
</shape>
'''

def colors(bg, ink, muted, accent, track):
    return '''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="widget_bg">%s</color>
    <color name="widget_ink">%s</color>
    <color name="widget_muted">%s</color>
    <color name="widget_accent">%s</color>
    <color name="widget_track">%s</color>
</resources>
''' % (bg, ink, muted, accent, track)

RECEIVERS = '''
        <receiver android:name="PKG.NextSessionWidget" android:exported="true" android:label="Bytewise learning card">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_next_info" />
        </receiver>
        <receiver android:name="PKG.ProgressWidget" android:exported="true" android:label="Bytewise progress">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_progress_info" />
        </receiver>
'''

for name, src in JAVA.items():
    write(os.path.join(java_dir, name), src.replace('PKG', PKG))
write(os.path.join(res, 'layout', 'widget_next.xml'), LAYOUT_NEXT)
write(os.path.join(res, 'layout', 'widget_progress.xml'), LAYOUT_PROGRESS)
write(os.path.join(res, 'xml', 'widget_next_info.xml'), provider('widget_next', 250, 330))
write(os.path.join(res, 'xml', 'widget_progress_info.xml'), provider('widget_progress', 250, 110))
write(os.path.join(res, 'drawable', 'widget_bg.xml'), BG)
for nm, rad in (('widget_shape_card', 28), ('widget_shape_pill', 18), ('widget_shape_btn', 22)):
    write(os.path.join(res, 'drawable', nm + '.xml'), '''<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#FFFFFFFF" />
    <corners android:radius="%ddp" />
</shape>
''' % rad)
write(os.path.join(res, 'drawable', 'widget_action_bg.xml'), '''<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="@color/widget_track" />
    <corners android:radius="10dp" />
</shape>''')
write(os.path.join(res, 'drawable', 'widget_action_primary_bg.xml'), '''<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="@color/widget_accent" />
    <corners android:radius="10dp" />
</shape>''')
write(os.path.join(res, 'values', 'widget_colors.xml'), colors('#F8FAFF', '#111A35', '#58668F', '#315CF5', '#D7E2FF'))
write(os.path.join(res, 'values-night', 'widget_colors.xml'), colors('#171B2D', '#F1F3FF', '#B4BBDD', '#7A4DFF', '#343B61'))

manifest = os.path.join(app, 'AndroidManifest.xml')
text = open(manifest, encoding='utf-8').read()
if 'NextSessionWidget' in text:
    print('manifest already patched')
else:
    if '</application>' not in text:
        sys.exit('add_widgets: </application> not found in AndroidManifest.xml')
    text = text.replace('</application>', RECEIVERS.replace('PKG', PKG) + '    </application>', 1)
    open(manifest, 'w', encoding='utf-8', newline='\n').write(text)
    print('patched', manifest)
print('widgets added for package', PKG)

# Notifications (Android 13+ needs this permission for the daily goal reminder)
text = open(manifest, encoding='utf-8').read()
if 'POST_NOTIFICATIONS' not in text and '<application' in text:
    text = text.replace('<application', '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n    <application', 1)
    open(manifest, 'w', encoding='utf-8', newline='\n').write(text)
    print('added POST_NOTIFICATIONS permission')
