package com.pincodeit.pinflix.source;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.hls.HlsMediaSource;
import androidx.media3.exoplayer.source.MediaSource;
import androidx.media3.exoplayer.source.ProgressiveMediaSource;
import androidx.media3.ui.PlayerView;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class PlayerActivity extends Activity {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private ExoPlayer player;
    private PlayerView video;
    private ProgressBar spinner;
    private TextView message;
    private FrameLayout screen;

    @Override
    protected void onCreate(Bundle bundle) {
        super.onCreate(bundle);
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        screen = new FrameLayout(this);
        screen.setBackgroundColor(Color.BLACK);
        setContentView(screen);

        video = new PlayerView(this);
        video.setUseController(true);
        video.setShowBuffering(PlayerView.SHOW_BUFFERING_ALWAYS);
        video.setKeepScreenOn(true);
        screen.addView(video, new FrameLayout.LayoutParams(-1, -1));

        LinearLayout overlay = new LinearLayout(this);
        overlay.setOrientation(LinearLayout.VERTICAL);
        overlay.setGravity(Gravity.CENTER);
        overlay.setPadding(dp(25), dp(25), dp(25), dp(25));
        spinner = new ProgressBar(this);
        overlay.addView(spinner);
        message = new TextView(this);
        message.setTextColor(Color.WHITE);
        message.setTextSize(15);
        message.setGravity(Gravity.CENTER);
        message.setPadding(0, dp(18), 0, 0);
        message.setText("Resolving provider video…");
        overlay.addView(message);
        screen.addView(overlay, new FrameLayout.LayoutParams(-1, -1));

        String rawId = getIntent().getStringExtra("id");
        String kind = getIntent().getStringExtra("kind");
        String title = getIntent().getStringExtra("title");
        int season = getIntent().getIntExtra("season", 1);
        int episode = getIntent().getIntExtra("episode", 1);
        if (rawId == null || title == null || kind == null ||
            (!kind.equals("movie") && !kind.equals("series")) ||
            !rawId.matches("(movie|series)-[0-9]+")) {
            reportError("Invalid playback request");
            return;
        }
        ProviderClient.Item item = new ProviderClient.Item(rawId, kind, title, "", "", "");
        worker.execute(() -> {
            try {
                ProviderClient.Stream stream = ProviderClient.playback(item, season, episode);
                runOnUiThread(() -> {
                    if (isFinishing() || isDestroyed()) return;
                    play(stream);
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    if (!isFinishing() && !isDestroyed())
                        reportError("Provider video unavailable\n" + error.getMessage());
                });
            }
        });
    }

    private int dp(int n) { return Math.round(n * getResources().getDisplayMetrics().density); }

    private void reportError(String detail) {
        if (spinner != null) spinner.setVisibility(View.GONE);
        if (message != null) message.setText(detail +
            "\n\nPlayback requires provider access and a supported network.\nPress Back to return.");
    }

    private void play(ProviderClient.Stream stream) {
        try {
            DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
                .setUserAgent("Mozilla/5.0 (Linux; Android) AppleWebKit/537.36")
                .setDefaultRequestProperties(stream.headers)
                .setConnectTimeoutMs(15000)
                .setReadTimeoutMs(30000)
                .setAllowCrossProtocolRedirects(false);
            DefaultDataSource.Factory data = new DefaultDataSource.Factory(this, http);
            MediaItem mediaItem = MediaItem.fromUri(stream.url);
            MediaSource mediaSource = stream.hls
                ? new HlsMediaSource.Factory(data).createMediaSource(mediaItem)
                : new ProgressiveMediaSource.Factory(data).createMediaSource(mediaItem);
            player = new ExoPlayer.Builder(this).build();
            video.setPlayer(player);
            player.addListener(new Player.Listener() {
                @Override
                public void onPlaybackStateChanged(int state) {
                    if (state == Player.STATE_READY) {
                        spinner.setVisibility(View.GONE);
                        message.setVisibility(View.GONE);
                    } else if (state == Player.STATE_ENDED) {
                        message.setVisibility(View.VISIBLE);
                        message.setText("Playback completed");
                    }
                }
                @Override
                public void onPlayerError(PlaybackException error) {
                    message.setVisibility(View.VISIBLE);
                    reportError("Unable to play this provider stream\n" + error.getErrorCodeName());
                }
            });
            player.setMediaSource(mediaSource);
            player.prepare();
            player.play();
        } catch (Exception error) {
            reportError("Video player failed to initialize\n" + error.getMessage());
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (player != null) player.pause();
    }

    @Override
    protected void onDestroy() {
        worker.shutdownNow();
        if (player != null) {
            video.setPlayer(null);
            player.release();
            player = null;
        }
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        super.onDestroy();
    }
}
