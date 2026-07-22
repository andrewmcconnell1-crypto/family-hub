package app.nest.family;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugin that lets the web app push "today" data to the home-
        // screen widget. Must be registered before super.onCreate().
        registerPlugin(NestWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
