package com.pincodeit.pinflix.source;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.PictureInPictureParams;
import android.content.res.ColorStateList;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Rational;
import android.view.GestureDetector;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.SeekBar;
import android.widget.TextView;

import androidx.media3.common.C;
import androidx.media3.common.Format;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.TrackSelectionOverride;
import androidx.media3.common.Tracks;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.hls.HlsMediaSource;
import androidx.media3.exoplayer.source.MediaSource;
import androidx.media3.exoplayer.source.ProgressiveMediaSource;
import androidx.media3.ui.AspectRatioFrameLayout;
import androidx.media3.ui.PlayerView;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class PlayerActivity extends Activity {
    private static final int CYAN = Color.rgb(103, 232, 249);
    private static final int WHITE = Color.rgb(245, 249, 255);
    private static final int MUTED = Color.rgb(175, 189, 215);
    private static final long SEEK_AMOUNT = 10000L;
    private static final float[] SPEEDS = { 0.5f, 0.75f, 1.0f, 1.25f, 1.5f, 2.0f };

    private final ExecutorService resolver = Executors.newSingleThreadExecutor();
    private final Handler ui = new Handler(Looper.getMainLooper());
    private ExoPlayer player;
    private PlayerView video;
    private FrameLayout surface;
    private LinearLayout topBar, centerControls, bottomBar, loadingLayer;
    private TextView playButton, speedButton, captionButton, fitButton, lockButton, qualityButton, timeline, statusText;
    private SeekBar timelineSeek, volumeSeek;
    private ProgressBar loadingSpinner;
    private GestureDetector detector;
    private boolean seeking = false, locked = false, controlsVisible = true, fitMode = true, captionsOn = true;
    private boolean inPip = false;
    private float speed = 1.0f;
    private int lastActiveVideoHeight = 0;
    private final Runnable hideTask = () -> setControlsVisible(false);
    private final Runnable updateTask = new Runnable() {
        @Override public void run() {
            if (player != null && !isFinishing()) {
                updateTimeline();
                ui.postDelayed(this, 500);
            }
        }
    };

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);
        immersive(true);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        speed = getPreferences(MODE_PRIVATE).getFloat("playback_speed", 1f);
        boolean validSpeed = false;
        for (float candidate : SPEEDS) if (candidate == speed) validSpeed = true;
        if (!validSpeed) speed = 1f;

        surface = new FrameLayout(this);
        surface.setBackgroundColor(Color.BLACK);
        setContentView(surface);

        video = new PlayerView(this);
        video.setUseController(false);
        video.setShowBuffering(PlayerView.SHOW_BUFFERING_WHEN_PLAYING);
        video.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_FIT);
        surface.addView(video, new FrameLayout.LayoutParams(-1, -1));

        detector = new GestureDetector(this, new GestureDetector.SimpleOnGestureListener() {
            @Override public boolean onDown(MotionEvent e) { return true; }
            @Override public boolean onSingleTapConfirmed(MotionEvent e) {
                if (locked) {
                    lockButton.setVisibility(View.VISIBLE);
                    ui.removeCallbacks(hideTask);
                    return true;
                }
                setControlsVisible(!controlsVisible);
                return true;
            }
            @Override public boolean onDoubleTap(MotionEvent e) {
                if (locked || player == null) return true;
                if (e.getX() < surface.getWidth() / 2f) seekRelative(-SEEK_AMOUNT);
                else seekRelative(SEEK_AMOUNT);
                setControlsVisible(true);
                return true;
            }
        });
        View touch = new View(this);
        touch.setOnTouchListener((v, event) -> detector.onTouchEvent(event));
        surface.addView(touch, new FrameLayout.LayoutParams(-1, -1));

        buildChrome();
        buildLoading();

        String rawId = getIntent().getStringExtra("id");
        String kind = getIntent().getStringExtra("kind");
        String title = getIntent().getStringExtra("title");
        int season = getIntent().getIntExtra("season", 1);
        int episode = getIntent().getIntExtra("episode", 1);
        if (rawId == null || title == null || kind == null ||
            (!kind.equals("movie") && !kind.equals("series")) ||
            !rawId.matches("(movie|series)-[0-9]+")) {
            fail("Invalid playback request.");
            return;
        }
        statusText.setText("Connecting to PinFlix…");
        TextView titleView = (TextView) topBar.getChildAt(1);
        titleView.setText(title + ("series".equals(kind) ? "  •  S" + season + " E" + episode : ""));
        ProviderClient.Item item = new ProviderClient.Item(rawId, kind, title, "", "", "");
        resolver.execute(() -> {
            try {
                ProviderClient.Stream stream = ProviderClient.playback(item, season, episode);
                runOnUiThread(() -> { if (!isFinishing() && !isDestroyed()) play(stream); });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    if (!isFinishing() && !isDestroyed()) fail("Stream unavailable: " + error.getMessage());
                });
            }
        });
    }

    private int dp(int px) {
        return Math.round(px * getResources().getDisplayMetrics().density);
    }
    private GradientDrawable rounded(int fill, int radius) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(fill);
        drawable.setCornerRadius(dp(radius));
        return drawable;
    }
    private GradientDrawable barGradient(boolean upper) {
        GradientDrawable drawable = new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
            upper ? new int[]{ 0xE9000000, 0x00000000 } : new int[]{ 0x00000000, 0xF6000000 });
        return drawable;
    }
    private TextView text(String value, int sp, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(sp);
        view.setTextColor(color);
        view.setGravity(Gravity.CENTER);
        if (bold) view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return view;
    }
    private TextView action(String label, int width, Runnable job) {
        TextView action = text(label, 15, WHITE, true);
        action.setBackground(rounded(0x66202B40, 13));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(width < 0 ? width : dp(width), dp(44));
        params.setMargins(dp(4), 0, dp(4), 0);
        action.setLayoutParams(params);
        action.setOnClickListener(v -> { job.run(); keepControls(); });
        return action;
    }
    private void immersive(boolean on) {
        int flags = View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE;
        if (on) flags |= View.SYSTEM_UI_FLAG_FULLSCREEN |
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
        getWindow().getDecorView().setSystemUiVisibility(flags);
    }
    private void buildChrome() {
        topBar = new LinearLayout(this);
        topBar.setGravity(Gravity.CENTER_VERTICAL);
        topBar.setPadding(dp(18), dp(12), dp(18), dp(24));
        topBar.setBackground(barGradient(true));
        FrameLayout.LayoutParams tp = new FrameLayout.LayoutParams(-1, -2, Gravity.TOP);
        surface.addView(topBar, tp);
        topBar.addView(action("‹ Back", 83, this::finish));
        TextView title = text("PinFlix Sources", 17, WHITE, true);
        title.setGravity(Gravity.CENTER_VERTICAL);
        title.setSingleLine(true);
        title.setEllipsize(android.text.TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(0, dp(44), 1);
        titleParams.setMargins(dp(12), 0, dp(8), 0);
        topBar.addView(title, titleParams);
        topBar.addView(action("PiP", 66, this::enterPip));

        centerControls = new LinearLayout(this);
        centerControls.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams centerParams = new FrameLayout.LayoutParams(-2, dp(74), Gravity.CENTER);
        surface.addView(centerControls, centerParams);
        TextView backward = action("↶ 10", 83, () -> seekRelative(-SEEK_AMOUNT));
        centerControls.addView(backward);
        playButton = action("▶", 76, this::togglePlayback);
        playButton.setTextSize(28);
        playButton.setBackground(rounded(0xDD213A51, 45));
        LinearLayout.LayoutParams cp = (LinearLayout.LayoutParams) playButton.getLayoutParams();
        cp.setMargins(dp(18), 0, dp(18), 0);
        centerControls.addView(playButton, cp);
        centerControls.addView(action("10 ↷", 83, () -> seekRelative(SEEK_AMOUNT)));

        bottomBar = new LinearLayout(this);
        bottomBar.setOrientation(LinearLayout.VERTICAL);
        bottomBar.setPadding(dp(22), dp(26), dp(22), dp(16));
        bottomBar.setBackground(barGradient(false));
        FrameLayout.LayoutParams bp = new FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM);
        surface.addView(bottomBar, bp);

        LinearLayout timelineRow = new LinearLayout(this);
        timelineRow.setGravity(Gravity.CENTER_VERTICAL);
        timeline = text("00:00 / --:--", 13, WHITE, false);
        timeline.setGravity(Gravity.CENTER_VERTICAL);
        timelineRow.addView(timeline, new LinearLayout.LayoutParams(dp(118), dp(38)));
        timelineSeek = new SeekBar(this);
        timelineSeek.setMax(1000);
        timelineSeek.setProgressTintList(ColorStateList.valueOf(CYAN));
        timelineSeek.setThumbTintList(ColorStateList.valueOf(CYAN));
        timelineRow.addView(timelineSeek, new LinearLayout.LayoutParams(0, dp(42), 1));
        timelineSeek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override public void onStartTrackingTouch(SeekBar seekBar) { seeking = true; ui.removeCallbacks(hideTask); }
            @Override public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                if (!fromUser || player == null) return;
                long duration = player.getDuration();
                if (duration > 0 && duration != C.TIME_UNSET) {
                    timeline.setText(clock((long) (duration * progress / 1000f)) + " / " + clock(duration));
                }
            }
            @Override public void onStopTrackingTouch(SeekBar seekBar) {
                seeking = false;
                if (player != null) {
                    long duration = player.getDuration();
                    if (duration > 0 && duration != C.TIME_UNSET)
                        player.seekTo((long) (duration * seekBar.getProgress() / 1000f));
                }
                keepControls();
            }
        });
        bottomBar.addView(timelineRow);

        LinearLayout optionsRow = new LinearLayout(this);
        optionsRow.setGravity(Gravity.CENTER_VERTICAL);
        speedButton = action(speedLabel(), 83, this::cycleSpeed);
        optionsRow.addView(speedButton);
        qualityButton = action("Auto", 84, this::showQualityDialog);
        optionsRow.addView(qualityButton);
        captionButton = action("CC On", 87, this::toggleCaptions);
        optionsRow.addView(captionButton);
        fitButton = action("Fit", 77, this::toggleFit);
        optionsRow.addView(fitButton);
        optionsRow.addView(action("Lock", 70, this::lockControls));
        TextView volumeIcon = text("♪", 19, MUTED, true);
        optionsRow.addView(volumeIcon, new LinearLayout.LayoutParams(dp(32), dp(44)));
        volumeSeek = new SeekBar(this);
        AudioManager audio = (AudioManager) getSystemService(AUDIO_SERVICE);
        if (audio != null) {
            volumeSeek.setMax(audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC));
            volumeSeek.setProgress(audio.getStreamVolume(AudioManager.STREAM_MUSIC));
            volumeSeek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
                @Override public void onProgressChanged(SeekBar bar, int value, boolean fromUser) {
                    if (fromUser) audio.setStreamVolume(AudioManager.STREAM_MUSIC, value, 0);
                }
                @Override public void onStartTrackingTouch(SeekBar bar) { ui.removeCallbacks(hideTask); }
                @Override public void onStopTrackingTouch(SeekBar bar) { keepControls(); }
            });
        }
        volumeSeek.setProgressTintList(ColorStateList.valueOf(CYAN));
        volumeSeek.setThumbTintList(ColorStateList.valueOf(CYAN));
        optionsRow.addView(volumeSeek, new LinearLayout.LayoutParams(0, dp(42), 1));
        bottomBar.addView(optionsRow);
        lockButton = text("🔒  Tap to unlock", 17, WHITE, true);
        lockButton.setBackground(rounded(0xDE15283A, 15));
        lockButton.setPadding(dp(24), dp(13), dp(24), dp(13));
        lockButton.setOnClickListener(v -> unlockControls());
        lockButton.setVisibility(View.GONE);
        FrameLayout.LayoutParams lockParams = new FrameLayout.LayoutParams(-2, -2, Gravity.CENTER);
        surface.addView(lockButton, lockParams);
    }

    private void buildLoading() {
        loadingLayer = new LinearLayout(this);
        loadingLayer.setOrientation(LinearLayout.VERTICAL);
        loadingLayer.setGravity(Gravity.CENTER);
        loadingLayer.setPadding(dp(24), dp(20), dp(24), dp(20));
        loadingLayer.setBackground(rounded(0xA9000000, 18));
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(-2, -2, Gravity.CENTER);
        surface.addView(loadingLayer, params);
        loadingSpinner = new ProgressBar(this);
        loadingSpinner.setIndeterminateTintList(ColorStateList.valueOf(CYAN));
        LinearLayout.LayoutParams spinnerParams = new LinearLayout.LayoutParams(dp(38), dp(38));
        spinnerParams.gravity = Gravity.CENTER_HORIZONTAL;
        loadingLayer.addView(loadingSpinner, spinnerParams);
        statusText = text("Resolving PinFlix stream…", 15, WHITE, false);
        statusText.setPadding(dp(6), dp(15), dp(6), 0);
        loadingLayer.addView(statusText);
    }

    private void fail(String message) {
        loadingLayer.setVisibility(View.VISIBLE);
        loadingSpinner.setVisibility(View.GONE);
        statusText.setText(message + "\n\nCheck your provider/network access, then return to try another title.");
        ui.removeCallbacks(hideTask);
        setControlsVisible(true);
    }
    private void play(ProviderClient.Stream stream) {
        try {
            if (!ProviderClient.allowedMedia(android.net.Uri.parse(stream.url))) {
                fail("Media origin is not allowed.");
                return;
            }
            DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
                .setUserAgent("Mozilla/5.0 (Linux; Android) AppleWebKit/537.36")
                .setDefaultRequestProperties(stream.headers)
                .setConnectTimeoutMs(15000)
                .setReadTimeoutMs(30000)
                .setAllowCrossProtocolRedirects(false);
            DefaultDataSource.Factory data = new DefaultDataSource.Factory(this, http);
            MediaItem media = MediaItem.fromUri(stream.url);
            MediaSource mediaSource = stream.hls
                ? new HlsMediaSource.Factory(data).createMediaSource(media)
                : new ProgressiveMediaSource.Factory(data).createMediaSource(media);
            player = new ExoPlayer.Builder(this).build();
            video.setPlayer(player);
            player.setPlaybackSpeed(speed);
            player.addListener(new Player.Listener() {
                @Override public void onPlaybackStateChanged(int state) {
                    if (state == Player.STATE_READY) {
                        loadingLayer.setVisibility(View.GONE);
                        updateTimeline();
                        keepControls();
                    } else if (state == Player.STATE_BUFFERING) {
                        loadingLayer.setVisibility(View.VISIBLE);
                        loadingSpinner.setVisibility(View.VISIBLE);
                        statusText.setText("Buffering…");
                    } else if (state == Player.STATE_ENDED) {
                        setControlsVisible(true);
                        playButton.setText("↺");
                    }
                }
                @Override public void onIsPlayingChanged(boolean playing) {
                    playButton.setText(playing ? "Ⅱ" : "▶");
                    if (!playing) {
                        ui.removeCallbacks(hideTask);
                        setControlsVisible(true);
                    } else keepControls();
                }
                @Override public void onTracksChanged(Tracks tracks) {
                    updateQualityLabel();
                    captionButton.setText(tracks.isTypeSupported(C.TRACK_TYPE_TEXT, false)
                        ? (captionsOn ? "CC On" : "CC Off") : "No CC");
                }
                @Override public void onPlayerError(PlaybackException error) {
                    fail("This video cannot be played: " + error.getErrorCodeName());
                }
            });
            player.setMediaSource(mediaSource);
            player.prepare();
            player.play();
            ui.post(updateTask);
        } catch (Exception ex) {
            fail("Player initialization failed: " + ex.getMessage());
        }
    }
    private String clock(long ms) {
        long s = Math.max(0L, ms / 1000L), hours = s / 3600, mins = (s / 60) % 60;
        if (hours > 0) return String.format(Locale.US, "%d:%02d:%02d", hours, mins, s % 60);
        return String.format(Locale.US, "%02d:%02d", mins, s % 60);
    }
    private void updateTimeline() {
        if (player == null) return;
        long length = player.getDuration(), pos = player.getCurrentPosition();
        boolean known = length > 0 && length != C.TIME_UNSET;
        timelineSeek.setEnabled(known);
        if (!seeking) {
            timeline.setText(clock(pos) + " / " + (known ? clock(length) : "--:--"));
            if (known) timelineSeek.setProgress((int) Math.min(1000, pos * 1000 / length));
        }
    }
    private void togglePlayback() {
        if (player == null) return;
        if (player.getPlaybackState() == Player.STATE_ENDED) player.seekTo(0);
        if (player.isPlaying()) player.pause();
        else player.play();
    }
    private void seekRelative(long offset) {
        if (player == null || !player.isCurrentMediaItemSeekable()) return;
        long position = Math.max(0, player.getCurrentPosition() + offset);
        long duration = player.getDuration();
        if (duration > 0 && duration != C.TIME_UNSET) position = Math.min(position, duration);
        player.seekTo(position);
        updateTimeline();
    }
    private String speedLabel() { return String.format(Locale.US, "%.2gx", speed); }
    private void cycleSpeed() {
        if (player == null) return;
        int next = 0;
        for (int i = 0; i < SPEEDS.length; i++)
            if (Math.abs(speed - SPEEDS[i]) < 0.01f) { next = (i + 1) % SPEEDS.length; break; }
        speed = SPEEDS[next];
        player.setPlaybackSpeed(speed);
        speedButton.setText(speedLabel());
        getPreferences(MODE_PRIVATE).edit().putFloat("playback_speed", speed).apply();
    }
    private void toggleCaptions() {
        if (player == null) return;
        boolean available = player.getCurrentTracks().isTypeSupported(C.TRACK_TYPE_TEXT, false);
        if (!available) { captionButton.setText("No CC"); return; }
        captionsOn = !captionsOn;
        player.setTrackSelectionParameters(player.getTrackSelectionParameters()
            .buildUpon().setTrackTypeDisabled(C.TRACK_TYPE_TEXT, !captionsOn).build());
        captionButton.setText(captionsOn ? "CC On" : "CC Off");
    }
    private void toggleFit() {
        fitMode = !fitMode;
        video.setResizeMode(fitMode ? AspectRatioFrameLayout.RESIZE_MODE_FIT
            : AspectRatioFrameLayout.RESIZE_MODE_ZOOM);
        fitButton.setText(fitMode ? "Fit" : "Zoom");
    }
    private void updateQualityLabel() {
        if (player == null) return;
        int pixels = 0;
        for (Tracks.Group group : player.getCurrentTracks().getGroups()) {
            if (group.getType() != C.TRACK_TYPE_VIDEO) continue;
            for (int i = 0; i < group.length; i++) {
                if (group.isTrackSelected(i)) {
                    Format f = group.getTrackFormat(i);
                    if (f.height > 0) pixels = f.height;
                }
            }
        }
        lastActiveVideoHeight = pixels;
        qualityButton.setText(pixels > 0 ? pixels + "p" : "Auto");
    }
    private void showQualityDialog() {
        if (player == null) return;
        List<String> labels = new ArrayList<>();
        List<TrackSelectionOverride> options = new ArrayList<>();
        labels.add("Auto • adaptive quality");
        options.add(null);
        for (Tracks.Group group : player.getCurrentTracks().getGroups()) {
            if (group.getType() != C.TRACK_TYPE_VIDEO) continue;
            for (int i = 0; i < group.length; i++) {
                Format format = group.getTrackFormat(i);
                if (format.height <= 0 && format.bitrate <= 0) continue;
                String name = format.height > 0 ? format.height + "p" : "Video";
                if (format.bitrate > 0) name += " • " + (format.bitrate / 1000) + " kbps";
                labels.add(name);
                options.add(new TrackSelectionOverride(group.getMediaTrackGroup(), i));
            }
        }
        new AlertDialog.Builder(this)
            .setTitle("Playback quality")
            .setItems(labels.toArray(new String[0]), (dialog, which) -> {
                if (player == null) return;
                androidx.media3.common.TrackSelectionParameters.Builder builder =
                    player.getTrackSelectionParameters().buildUpon().clearOverridesOfType(C.TRACK_TYPE_VIDEO);
                if (options.get(which) != null) builder.addOverride(options.get(which));
                player.setTrackSelectionParameters(builder.build());
                if (which == 0) qualityButton.setText("Auto");
                else qualityButton.setText(labels.get(which).split(" • ")[0]);
                keepControls();
            })
            .show();
    }
    private void lockControls() {
        locked = true;
        topBar.setVisibility(View.GONE);
        centerControls.setVisibility(View.GONE);
        bottomBar.setVisibility(View.GONE);
        lockButton.setVisibility(View.VISIBLE);
        ui.removeCallbacks(hideTask);
    }
    private void unlockControls() {
        locked = false;
        lockButton.setVisibility(View.GONE);
        setControlsVisible(true);
    }
    private void keepControls() {
        if (locked || inPip) return;
        setControlsVisible(true);
        ui.removeCallbacks(hideTask);
        if (player != null && player.isPlaying()) ui.postDelayed(hideTask, 4500);
    }
    private void setControlsVisible(boolean visible) {
        if (locked || inPip) return;
        controlsVisible = visible;
        int value = visible ? View.VISIBLE : View.GONE;
        topBar.setVisibility(value);
        centerControls.setVisibility(value);
        bottomBar.setVisibility(value);
        if (visible && player != null && player.isPlaying()) {
            ui.removeCallbacks(hideTask);
            ui.postDelayed(hideTask, 4500);
        }
    }
    private void enterPip() {
        if (Build.VERSION.SDK_INT < 26 || player == null) return;
        try {
            PictureInPictureParams parameters = new PictureInPictureParams.Builder()
                .setAspectRatio(new Rational(16, 9)).build();
            enterPictureInPictureMode(parameters);
        } catch (Exception ignored) {
            // The device or its launcher may not support Picture-in-Picture.
        }
    }
    @Override public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, Configuration config) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, config);
        inPip = isInPictureInPictureMode;
        if (inPip) {
            topBar.setVisibility(View.GONE);
            bottomBar.setVisibility(View.GONE);
            centerControls.setVisibility(View.GONE);
            lockButton.setVisibility(View.GONE);
            loadingLayer.setVisibility(View.GONE);
        } else {
            lockButton.setVisibility(locked ? View.VISIBLE : View.GONE);
            if (!locked) keepControls();
        }
    }
    @Override protected void onPause() {
        super.onPause();
        if (!inPip && player != null) player.pause();
    }
    @Override protected void onResume() {
        super.onResume();
        immersive(true);
    }
    @Override protected void onDestroy() {
        ui.removeCallbacks(hideTask);
        ui.removeCallbacks(updateTask);
        resolver.shutdownNow();
        if (player != null) {
            video.setPlayer(null);
            player.release();
            player = null;
        }
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        super.onDestroy();
    }
}
