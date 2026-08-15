package com.id4drive.admin;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // WebView, на відміну від Chrome, не застосовує системний розмір шрифту сам —
        // синхронізуємо textZoom з fontScale (+20% зверху за проханням) для крупнішого тексту в APK
        float fontScale = getResources().getConfiguration().fontScale;
        getBridge().getWebView().getSettings().setTextZoom(Math.round(fontScale * 100 * 1.2f));
    }
}
