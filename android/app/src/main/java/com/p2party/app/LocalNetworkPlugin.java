package com.p2party.app;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
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
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.CINNAMON_BUN
            && getContext().getApplicationInfo().targetSdkVersion >= Build.VERSION_CODES.CINNAMON_BUN;
    }

    private SharedPreferences permissionHistory() {
        return getContext().getSharedPreferences("local-network", Context.MODE_PRIVATE);
    }

    @PluginMethod
    public void beginRoom(PluginCall call) {
        if (needsPermission() && getPermissionState("lan") != PermissionState.GRANTED) {
            var preferences = permissionHistory();
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
        boolean denied = needsPermission() && permissionHistory().getBoolean("asked", false)
            && getPermissionState("lan") != PermissionState.GRANTED;
        result.put("denied", denied);
        call.resolve(result);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        var intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.fromParts("package", getContext().getPackageName(), null));
        try {
            getActivity().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException exception) {
            call.reject("Android app permission settings are unavailable.", exception);
        }
    }
}
