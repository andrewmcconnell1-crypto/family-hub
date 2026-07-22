package app.nest.family;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

// The Nest home-screen widget: a compact "Today" list of events + to-dos. It
// renders from a JSON snapshot the app writes to SharedPreferences (see
// NestWidgetPlugin), so it works without running any JS. Tapping it opens Nest.
public class NestWidgetProvider extends AppWidgetProvider {
    static final String PREFS = "NestWidget";
    static final String KEY_DATA = "data";
    static final int MAX_ROWS = 6;

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        RemoteViews views = build(context);
        for (int id : ids) manager.updateAppWidget(id, views);
    }

    // Called by the plugin after new data lands, to refresh every placed widget.
    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, NestWidgetProvider.class));
        if (ids == null || ids.length == 0) return;
        RemoteViews views = build(context);
        for (int id : ids) manager.updateAppWidget(id, views);
    }

    private static RemoteViews build(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_nest);

        Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (open != null) {
            open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pending = PendingIntent.getActivity(
                context, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_root, pending);
        }

        views.removeAllViews(R.id.widget_list);
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String json = prefs.getString(KEY_DATA, null);

        if (json == null) {
            views.setTextViewText(R.id.widget_date, "Today");
            addRow(context, views, "", "Open Nest to sync");
            return views;
        }

        try {
            JSONObject obj = new JSONObject(json);
            views.setTextViewText(R.id.widget_date, obj.optString("date", "Today"));
            JSONArray items = obj.optJSONArray("items");
            int count = items == null ? 0 : items.length();
            if (count == 0) {
                addRow(context, views, "", "Nothing on today 🎉");
            } else {
                int shown = Math.min(count, MAX_ROWS);
                for (int i = 0; i < shown; i++) {
                    JSONObject item = items.getJSONObject(i);
                    String time = item.optString("time", "");
                    addRow(context, views, time.isEmpty() ? "•" : time, item.optString("text", ""));
                }
                if (count > shown) addRow(context, views, "", "+" + (count - shown) + " more");
            }
        } catch (Exception e) {
            views.setTextViewText(R.id.widget_date, "Today");
            addRow(context, views, "", "Open Nest to sync");
        }
        return views;
    }

    private static void addRow(Context context, RemoteViews container, String time, String text) {
        RemoteViews row = new RemoteViews(context.getPackageName(), R.layout.widget_row);
        row.setTextViewText(R.id.row_time, time);
        row.setTextViewText(R.id.row_text, text);
        container.addView(R.id.widget_list, row);
    }
}
