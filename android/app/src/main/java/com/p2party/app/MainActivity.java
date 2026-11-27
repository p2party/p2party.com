package com.p2party.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle state) {
        registerPlugin(LocalNetworkPlugin.class);
        super.onCreate(state);
    }
}
