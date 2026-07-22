package app.nest.family;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Bridge from the web app to the home-screen widget: the app computes today's
// events + to-dos and calls setData(json); we stash it in SharedPreferences and
// tell the widget to redraw. The widget process reads that same prefs file.
@CapacitorPlugin(name = "NestWidget")
public class NestWidgetPlugin extends Plugin {
    @PluginMethod
    public void setData(PluginCall call) {
        String json = call.getString("json", "");
        Context ctx = getContext();
        SharedPreferences prefs = ctx.getSharedPreferences(NestWidgetProvider.PREFS, Context.MODE_PRIVATE);
        prefs.edit().putString(NestWidgetProvider.KEY_DATA, json).apply();
        NestWidgetProvider.updateAll(ctx);
        call.resolve();
    }
}
