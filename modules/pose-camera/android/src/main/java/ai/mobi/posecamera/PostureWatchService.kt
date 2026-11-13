package ai.mobi.posecamera

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import android.util.Log
import android.util.Size
import androidx.annotation.OptIn
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.pose.Pose
import com.google.mlkit.vision.pose.PoseDetection
import com.google.mlkit.vision.pose.PoseLandmark
import com.google.mlkit.vision.pose.accurate.AccuratePoseDetectorOptions
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

// 주행 중 자세 관찰 (C-7 시험판). 주행 중에는 앱 화면이 가려져 화면에 묶인 카메라(PoseCameraView)가 꺼지므로,
// 화면 없이 도는 카메라 포그라운드 서비스로 몇 초에 한 장씩 관절 위치만 뽑아 메모리에 쌓는다.
// 개인정보 원칙은 PoseCameraView 와 같다: 프레임은 메모리에서 분석하고 바로 버린다. 파일·네트워크로 보내지 않는다.
// Android 14 부터 카메라 포그라운드 서비스는 앱이 화면에 보일 때만 시작할 수 있다. 그래서 주차(P) 중에 시작한다.
class PostureWatchService :
  Service(),
  LifecycleOwner {
  private val registry = LifecycleRegistry(this)
  override val lifecycle: Lifecycle get() = registry

  private val analysisExecutor: ExecutorService = Executors.newSingleThreadExecutor()
  private val detector by lazy {
    PoseDetection.getClient(
      AccuratePoseDetectorOptions
        .Builder()
        // 몇 초에 한 장만 보지만 같은 사람을 이어 보므로 연속 모드로 둔다 (앞 프레임 결과로 찾는 범위를 좁힌다).
        .setDetectorMode(AccuratePoseDetectorOptions.STREAM_MODE)
        .build(),
    )
  }
  private var provider: ProcessCameraProvider? = null

  @Volatile
  private var mirrored = false

  @Volatile
  private var lastSampleAt = 0L

  @Volatile
  private var busy = false

  override fun onCreate() {
    super.onCreate()
    registry.currentState = Lifecycle.State.CREATED
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(
    intent: Intent?,
    flags: Int,
    startId: Int,
  ): Int {
    if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
      PostureWatchStore.fail("ERR_CAMERA_PERMISSION")
      stopSelf()
      return START_NOT_STICKY
    }
    try {
      ServiceCompat.startForeground(this, NOTIFICATION_ID, notification(), cameraServiceType())
    } catch (error: Exception) {
      // 앱이 화면에 없을 때 시작하면 Android 14 이상에서 막힌다.
      Log.w(TAG, "startForeground failed", error)
      PostureWatchStore.fail("ERR_CAMERA_FAILED")
      stopSelf()
      return START_NOT_STICKY
    }
    registry.currentState = Lifecycle.State.STARTED
    PostureWatchStore.started()
    bindCamera()
    // 시스템이 서비스를 죽였다가 다시 살릴 때는 화면 없이 카메라를 열 수 없으므로 되살리지 않는다.
    return START_NOT_STICKY
  }

  private fun bindCamera() {
    val future = ProcessCameraProvider.getInstance(this)
    future.addListener(
      {
        try {
          val cameraProvider = future.get()
          val cameras = cameraProvider.availableCameraInfos
          if (cameras.isEmpty()) {
            PostureWatchStore.fail("ERR_NO_CAMERA")
            stopSelf()
            return@addListener
          }
          // 운전자를 보는 쪽(전면)이 있으면 그것을, 없으면 첫 카메라를 쓴다 (에뮬레이터는 후면 모의 카메라뿐이다).
          val info = cameras.firstOrNull { it.lensFacing == CameraSelector.LENS_FACING_FRONT } ?: cameras.first()
          mirrored = info.lensFacing == CameraSelector.LENS_FACING_FRONT
          val analysis =
            ImageAnalysis
              .Builder()
              .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
              .setResolutionSelector(
                ResolutionSelector
                  .Builder()
                  .setResolutionStrategy(
                    ResolutionStrategy(ANALYSIS_SIZE, ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER),
                  ).build(),
              ).build()
              .apply { setAnalyzer(analysisExecutor, ::analyze) }
          cameraProvider.unbindAll()
          cameraProvider.bindToLifecycle(this, info.cameraSelector, analysis)
          provider = cameraProvider
        } catch (error: Exception) {
          Log.w(TAG, "camera bind failed", error)
          PostureWatchStore.fail("ERR_CAMERA_FAILED")
          stopSelf()
        }
      },
      mainExecutor,
    )
  }

  // 대부분의 프레임은 바로 버린다. SAMPLE_INTERVAL_MS 마다 한 장만 분석한다.
  @OptIn(ExperimentalGetImage::class)
  private fun analyze(frame: ImageProxy) {
    val now = SystemClock.elapsedRealtime()
    val image = frame.image
    if (busy || image == null || now - lastSampleAt < SAMPLE_INTERVAL_MS) {
      frame.close()
      return
    }
    busy = true
    lastSampleAt = now
    val rotation = frame.imageInfo.rotationDegrees
    val sideways = rotation % 180 != 0
    val width = if (sideways) frame.height else frame.width
    val height = if (sideways) frame.width else frame.height
    val at = System.currentTimeMillis()
    try {
      detector
        .process(InputImage.fromMediaImage(image, rotation))
        .addOnSuccessListener { pose -> PostureWatchStore.add(sample(pose, at, width, height)) }
        .addOnFailureListener { error -> Log.w(TAG, "pose failed", error) }
        .addOnCompleteListener {
          frame.close()
          busy = false
        }
    } catch (error: Exception) {
      frame.close()
      busy = false
      Log.w(TAG, "pose failed", error)
    }
  }

  private fun sample(
    pose: Pose,
    at: Long,
    width: Int,
    height: Int,
  ): Map<String, Any> =
    mapOf(
      "at" to at.toDouble(),
      "width" to width,
      "height" to height,
      // 자세 변화에 필요한 상반신 관절만 남긴다. 사람을 찾지 못하면 빈 목록이다.
      "landmarks" to
        pose.allPoseLandmarks.mapNotNull { landmark ->
          UPPER_BODY[landmark.landmarkType]?.let { name ->
            mapOf(
              "name" to name,
              "x" to (if (mirrored) width - landmark.position.x else landmark.position.x).toDouble(),
              "y" to landmark.position.y.toDouble(),
              "likelihood" to landmark.inFrameLikelihood.toDouble(),
            )
          }
        },
    )

  override fun onDestroy() {
    registry.currentState = Lifecycle.State.DESTROYED
    provider?.unbindAll()
    analysisExecutor.shutdown()
    detector.close()
    PostureWatchStore.stopped()
    super.onDestroy()
  }

  private fun cameraServiceType(): Int =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA else 0

  private fun notification(): Notification {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_ID, "운전 자세 살펴보기", NotificationManager.IMPORTANCE_MIN),
    )
    // 포그라운드 서비스는 알림이 꼭 있어야 한다. 주행 중 눈길을 끌지 않게 가장 낮은 중요도로 둔다.
    return NotificationCompat
      .Builder(this, CHANNEL_ID)
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle("운전 자세를 살펴보고 있어요")
      .setContentText("영상은 저장하지 않아요")
      .setOngoing(true)
      .setSilent(true)
      .build()
  }

  companion object {
    private const val TAG = "PostureWatch"
    private const val CHANNEL_ID = "posture_watch"
    private const val NOTIFICATION_ID = 0x50_57
    private const val SAMPLE_INTERVAL_MS = 5_000L
    private val ANALYSIS_SIZE = Size(640, 480)

    // JS 계약(src/PoseCamera.types.ts 의 POSE_LANDMARK_NAMES)과 같은 이름이다.
    private val UPPER_BODY: Map<Int, String> =
      mapOf(
        PoseLandmark.NOSE to "nose",
        PoseLandmark.LEFT_EYE to "leftEye",
        PoseLandmark.RIGHT_EYE to "rightEye",
        PoseLandmark.LEFT_EAR to "leftEar",
        PoseLandmark.RIGHT_EAR to "rightEar",
        PoseLandmark.LEFT_SHOULDER to "leftShoulder",
        PoseLandmark.RIGHT_SHOULDER to "rightShoulder",
        PoseLandmark.LEFT_ELBOW to "leftElbow",
        PoseLandmark.RIGHT_ELBOW to "rightElbow",
        PoseLandmark.LEFT_HIP to "leftHip",
        PoseLandmark.RIGHT_HIP to "rightHip",
      )

    fun start(context: Context) {
      context.startForegroundService(Intent(context, PostureWatchService::class.java))
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, PostureWatchService::class.java))
    }
  }
}

/** 서비스가 모은 표본. 앱 프로세스 안 메모리에만 있다. 프로세스가 죽으면 함께 사라진다. */
object PostureWatchStore {
  // 5초에 한 장이면 약 4시간 분량이다. 넘으면 오래된 것부터 버린다.
  private const val MAX_SAMPLES = 3_000
  private val samples = ArrayDeque<Map<String, Any>>()
  private var running = false
  private var error: String? = null
  private var startedAt = 0.0

  @Synchronized
  fun started() {
    samples.clear()
    running = true
    error = null
    startedAt = System.currentTimeMillis().toDouble()
  }

  @Synchronized
  fun add(sample: Map<String, Any>) {
    if (!running) return
    if (samples.size >= MAX_SAMPLES) samples.removeFirst()
    samples.addLast(sample)
  }

  @Synchronized
  fun fail(code: String) {
    error = code
    running = false
  }

  @Synchronized
  fun stopped() {
    running = false
  }

  @Synchronized
  fun status(): Map<String, Any?> =
    mapOf(
      "running" to running,
      "startedAt" to startedAt,
      "sampleCount" to samples.size,
      "lastSampleAt" to (samples.lastOrNull()?.get("at")),
      "error" to error,
    )

  /** 모은 표본을 넘기고 비운다. 한 번 읽은 표본은 다시 주지 않는다. */
  @Synchronized
  fun drain(): List<Map<String, Any>> {
    val out = samples.toList()
    samples.clear()
    return out
  }
}
