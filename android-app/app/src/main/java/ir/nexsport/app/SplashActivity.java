package ir.nexsport.app;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

public class SplashActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_splash);

        Intent incoming = getIntent();
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            Intent next = new Intent(SplashActivity.this, MainActivity.class);
            if (incoming.getData() != null) {
                next.setData(incoming.getData());
            }
            startActivity(next);
            finish();
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
        }, 1100);
    }
}
