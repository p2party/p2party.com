package com.p2party.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "RoomLocalNetwork",
    permissions = @Permission(alias = "lan", strings = { Manifest.permission.ACCESS_LOCAL_NETWORK })
)
public class LocalNetworkPlugin extends Plugin {
    private boolean needsPermission() {
        return Build.VERSION.SDK_INT >= 37 && getContext().getApplicationInfo().targetSdkVersion >= 37;
    }

    @PluginMethod
    public void beginRoom(PluginCall call) {
        if (needsPermission() && getPermissionState("lan") != PermissionState.GRANTED) {
            var preferences = getContext().getSharedPreferences("local-network", Context.MODE_PRIVATE);
            if (!preferences.getBoolean("asked", false)) {
                preferences.edit().putBoolean("asked", true).apply();
                requestPermissionForAlias("lan", call, "reportAccess");
                return;
            }
        }
        reportAccess(call);
    }

    @PluginMethod
    public void currentAccess(PluginCall call) {
        reportAccess(call);
    }

    @PermissionCallback
    private void reportAccess(PluginCall call) {
        JSObject result = new JSObject();
        result.put("allowed", !needsPermission() || getPermissionState("lan") == PermissionState.GRANTED);
        call.resolve(result);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        var intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.fromParts("package", getContext().getPackageName(), null));
        getActivity().startActivity(intent);
        call.resolve();
    }
}
