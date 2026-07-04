package com.ablpayroll.system;

import android.animation.AnimatorSet;
import android.animation.ObjectAnimator;
import android.animation.PropertyValuesHolder;
import android.animation.ValueAnimator;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Shader;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.animation.OvershootInterpolator;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;

public class SplashActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_splash);

        TextView logoText = findViewById(R.id.logo_text);
        TextView subtitle = findViewById(R.id.subtitle);
        TextView services = findViewById(R.id.services);
        View divider = findViewById(R.id.divider);
        View glowDot = findViewById(R.id.glow_dot);
        View ring1 = findViewById(R.id.ring1);
        View ring2 = findViewById(R.id.ring2);
        View ring3 = findViewById(R.id.ring3);

        logoText.post(() -> {
            Shader logoShader = new LinearGradient(0, 0, 0, logoText.getHeight(),
                    new int[]{
                            Color.parseColor("#ffffff"),
                            Color.parseColor("#d8e6f5"),
                            Color.parseColor("#7fb8e8"),
                            Color.parseColor("#3a6fa8"),
                            Color.parseColor("#1a3a5c")
                    },
                    new float[]{0f, 0.35f, 0.55f, 0.75f, 1f},
                    Shader.TileMode.CLAMP);
            logoText.getPaint().setShader(logoShader);
        });
        logoText.setShadowLayer(18, 0, 0, Color.parseColor("#804FC3F7"));

        subtitle.post(() -> {
            Shader subtitleShader = new LinearGradient(0, 0, subtitle.getWidth(), 0,
                    new int[]{
                            Color.parseColor("#4fc3f7"),
                            Color.parseColor("#7c4dff"),
                            Color.parseColor("#4fc3f7")
                    },
                    null, Shader.TileMode.CLAMP);
            subtitle.getPaint().setShader(subtitleShader);
        });

        animateRing(ring1, 0);
        animateRing(ring2, 800);
        animateRing(ring3, 1600);

        logoText.setScaleX(0.7f);
        logoText.setScaleY(0.7f);
        logoText.setAlpha(0f);
        logoText.animate()
                .scaleX(1f).scaleY(1f).alpha(1f)
                .setDuration(1000)
                .setStartDelay(300)
                .setInterpolator(new OvershootInterpolator(1.3f))
                .start();

        subtitle.setTranslationY(40f);
        subtitle.setAlpha(0f);
        subtitle.animate()
                .translationY(0f).alpha(1f)
                .setDuration(800)
                .setStartDelay(1200)
                .start();

        divider.setScaleX(0f);
        divider.animate()
                .scaleX(1f)
                .setDuration(800)
                .setStartDelay(1500)
                .start();

        services.setTranslationY(40f);
        services.setAlpha(0f);
        services.animate()
                .translationY(0f).alpha(1f)
                .setDuration(800)
                .setStartDelay(1700)
                .start();

        glowDot.setScaleX(0.2f);
        glowDot.setScaleY(0.2f);
        glowDot.setAlpha(0f);

        ObjectAnimator scaleUpX = ObjectAnimator.ofFloat(glowDot, "scaleX", 0.2f, 1.3f);
        ObjectAnimator scaleUpY = ObjectAnimator.ofFloat(glowDot, "scaleY", 0.2f, 1.3f);
        ObjectAnimator alphaUp = ObjectAnimator.ofFloat(glowDot, "alpha", 0f, 1f);
        AnimatorSet popUp = new AnimatorSet();
        popUp.playTogether(scaleUpX, scaleUpY, alphaUp);
        popUp.setDuration(400);

        ObjectAnimator scaleDownX = ObjectAnimator.ofFloat(glowDot, "scaleX", 1.3f, 0.4f);
        ObjectAnimator scaleDownY = ObjectAnimator.ofFloat(glowDot, "scaleY", 1.3f, 0.4f);
        ObjectAnimator alphaDown = ObjectAnimator.ofFloat(glowDot, "alpha", 1f, 0f);
        AnimatorSet dropDown = new AnimatorSet();
        dropDown.playTogether(scaleDownX, scaleDownY, alphaDown);
        dropDown.setDuration(600);

        AnimatorSet flash = new AnimatorSet();
        flash.playSequentially(popUp, dropDown);
        flash.start();

        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            Intent intent = new Intent(SplashActivity.this, MainActivity.class);
            startActivity(intent);
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
            finish();
        }, 5000);
    }

    private void animateRing(View ring, long delay) {
        PropertyValuesHolder scaleX = PropertyValuesHolder.ofFloat("scaleX", 0.7f, 2.2f);
        PropertyValuesHolder scaleY = PropertyValuesHolder.ofFloat("scaleY", 0.7f, 2.2f);
        PropertyValuesHolder alpha = PropertyValuesHolder.ofFloat("alpha", 0.7f, 0f);
        
        ObjectAnimator animator = ObjectAnimator.ofPropertyValuesHolder(ring, scaleX, scaleY, alpha);
        animator.setDuration(2400);
        animator.setStartDelay(delay);
        animator.setRepeatCount(ValueAnimator.INFINITE);
        animator.setRepeatMode(ValueAnimator.RESTART);
        animator.start();
    }
}
