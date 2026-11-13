package ai.mobi.posecamera

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Handler
import android.os.Looper
import android.util.Size
import android.view.ViewGroup
import androidx.annotation.OptIn
import androidx.camera.core.CameraInfo
import androidx.camera.core.CameraSelector
import androidx.camera.core.CameraState
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.core.UseCase
import androidx.camera.core.resolutionselector.AspectRatioStrategy
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LiveData
import androidx.lifecycle.Observer
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.pose.Pose
import com.google.mlkit.vision.pose.PoseDetection
import com.google.mlkit.vision.pose.PoseLandmark
import com.google.mlkit.vision.pose.accurate.AccuratePoseDetectorOptions
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicReference

// 카메라 미리보기 + "지금 화면 한 장"의 관절 위치 인식.
// 개인정보 원칙: 카메라 프레임은 메모리에서만 다룬다. 파일로 쓰지 않고, 네트워크로 보내지 않고, JS 로도 넘기지 않는다.
// JS 가 받는 것은 관절 좌표(숫자)뿐이다.
class PoseCameraView(
  context: Context,
  appContext: AppContext,
) : ExpoView(context, appContext) {
  private val onCameraReady by EventDispatcher<Map<String, Any>>()
  private val onCameraError by EventDispatcher<Map<String, Any>>()

  // PreviewView 는 화면(TextureView)을 나중에 스스로 붙인다. React Native 배치만 쓰면 그 화면의 크기가 0 으로 남는다.
  override val shouldUseAndroidLayout = true

  private val previewView =
    PreviewView(context).apply {
      layoutParams = LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
      // 찍히는 범위 전체를 보여 준다. 잘라서 채우면 화면에 보이는 범위와 분석하는 범위가 달라져 "발끝까지 보이게" 안내가 틀어진다.
      scaleType = PreviewView.ScaleType.FIT_CENTER
      // SurfaceView 는 React Native 화면과 겹치는 순서·둥근 모서리가 어긋나 TextureView 로 그린다.
      implementationMode = PreviewView.ImplementationMode.COMPATIBLE
    }

  private val mainHandler = Handler(Looper.getMainLooper())
  private val analysisExecutor: ExecutorService = Executors.newSingleThreadExecutor()

  // 모델은 APK 에 들어 있어 내려받지 않는다 (Google Play 서비스가 없는 차량에서도 동작해야 한다).
  private val detectorLazy =
    lazy {
      PoseDetection.getClient(
        AccuratePoseDetectorOptions
          .Builder()
          .setDetectorMode(AccuratePoseDetectorOptions.SINGLE_IMAGE_MODE)
          .build(),
      )
    }

  private var provider: ProcessCameraProvider? = null

  @Volatile
  private var useCases: List<UseCase> = emptyList()
  private var cameraState: LiveData<CameraState>? = null
  private val cameraStateObserver =
    Observer<CameraState> { state ->
      state.error?.let { fail(CameraFailedException("카메라 오류 (code ${it.code})", it.cause)) }
    }
  private var cameraIndex = 0

  // 전면 카메라의 미리보기는 거울처럼 좌우가 뒤집혀 보인다. 관절 좌표도 같은 방향으로 뒤집어야
  // 결과 그림이 방금 본 화면과 같은 쪽에 그려진다.
  @Volatile
  private var mirrored = false
  private var attached = false

  // 촬영 요청 하나. 분석 스레드가 다음 프레임에서 꺼내 간다.
  private val pending = AtomicReference<Promise?>(null)
  private val captureTimeout = Runnable { pending.getAndSet(null)?.reject(CameraTimeoutException()) }

  init {
    addView(previewView)
  }

  /** 여러 카메라 중 몇 번째를 쓸지. 범위를 넘으면 처음으로 돌아간다 (JS 는 1 씩 더하기만 하면 된다). */
  fun setCameraIndex(index: Int) {
    if (index == cameraIndex) return
    cameraIndex = index
    if (attached) start()
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    attached = true
    start()
  }

  override fun onDetachedFromWindow() {
    attached = false
    stop()
    super.onDetachedFromWindow()
  }

  private fun start() {
    if (context.checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
      return fail(CameraPermissionException())
    }
    val owner =
      appContext.currentActivity as? LifecycleOwner
        ?: return fail(CameraFailedException("앱 화면(Activity)을 찾지 못했습니다"))
    val future = ProcessCameraProvider.getInstance(context)
    future.addListener(
      {
        if (attached) {
          try {
            bind(future.get(), owner)
          } catch (error: Exception) {
            fail(error as? CodedException ?: CameraFailedException("카메라를 열지 못했습니다: ${error.message}", error))
          }
        }
      },
      context.mainExecutor,
    )
  }

  private fun bind(
    cameraProvider: ProcessCameraProvider,
    owner: LifecycleOwner,
  ) {
    val cameras = cameraProvider.availableCameraInfos
    if (cameras.isEmpty()) throw NoCameraException()
    val index = cameraIndex.mod(cameras.size)
    val info = cameras[index]

    // 미리보기와 분석이 같은 화면비(4:3, 보통 센서 전체)를 쓰게 한다. 비율이 다르면 한쪽이 위아래를 잘라
    // 미리보기에는 발끝이 보이는데 분석에서는 빠지는 일이 생긴다.
    val preview =
      Preview
        .Builder()
        .setResolutionSelector(ResolutionSelector.Builder().setAspectRatioStrategy(ASPECT).build())
        .build()
        .apply { setSurfaceProvider(previewView.surfaceProvider) }
    val analysis =
      ImageAnalysis
        .Builder()
        // 밀린 프레임을 쌓지 않는다. 촬영 요청이 오면 가장 최근 한 장만 본다.
        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
        .setResolutionSelector(
          ResolutionSelector
            .Builder()
            .setAspectRatioStrategy(ASPECT)
            .setResolutionStrategy(
              ResolutionStrategy(ANALYSIS_SIZE, ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER),
            ).build(),
        ).build()
        .apply { setAnalyzer(analysisExecutor, ::analyze) }

    stop()
    val camera = cameraProvider.bindToLifecycle(owner, info.cameraSelector, preview, analysis)
    provider = cameraProvider
    useCases = listOf(preview, analysis)
    mirrored = info.lensFacing == CameraSelector.LENS_FACING_FRONT
    cameraState = camera.cameraInfo.cameraState.also { it.observe(owner, cameraStateObserver) }
    onCameraReady(
      mapOf(
        "cameraCount" to cameras.size,
        "cameraIndex" to index,
        "facing" to facingOf(info),
      ),
    )
  }

  private fun stop() {
    mainHandler.removeCallbacks(captureTimeout)
    pending.getAndSet(null)?.reject(CameraFailedException("카메라가 꺼졌습니다"))
    cameraState?.removeObserver(cameraStateObserver)
    cameraState = null
    if (useCases.isNotEmpty()) provider?.unbind(*useCases.toTypedArray())
    useCases = emptyList()
  }

  /** 화면이 사라질 때 한 번 부른다. 다시 쓰지 않는다. */
  fun release() {
    attached = false
    stop()
    analysisExecutor.shutdown()
    if (detectorLazy.isInitialized()) detectorLazy.value.close()
  }

  fun capturePose(promise: Promise) {
    if (useCases.isEmpty()) return promise.reject(CameraFailedException("카메라가 켜져 있지 않습니다"))
    if (!pending.compareAndSet(null, promise)) return promise.reject(CameraBusyException())
    mainHandler.postDelayed(captureTimeout, CAPTURE_TIMEOUT_MS)
  }

  // 미리보기 중에는 프레임을 바로 버린다. 촬영 요청이 있을 때만 그 한 장을 메모리에서 분석하고, 끝나면 닫는다.
  @OptIn(ExperimentalGetImage::class)
  private fun analyze(frame: ImageProxy) {
    val promise = pending.getAndSet(null)
    val image = frame.image
    if (promise == null || image == null) {
      frame.close()
      promise?.reject(CameraFailedException("카메라 화면을 읽지 못했습니다"))
      return
    }
    mainHandler.removeCallbacks(captureTimeout)

    // ML Kit 은 사람이 바로 선 방향으로 돌린 뒤의 좌표를 준다. 가로·세로도 그 기준으로 넘긴다.
    val rotation = frame.imageInfo.rotationDegrees
    val sideways = rotation % 180 != 0
    val width = if (sideways) frame.height else frame.width
    val height = if (sideways) frame.width else frame.height
    try {
      detectorLazy.value
        .process(InputImage.fromMediaImage(image, rotation))
        .addOnSuccessListener { pose -> promise.resolve(poseResult(pose, width, height)) }
        .addOnFailureListener { error -> promise.reject(PoseFailedException(error)) }
        .addOnCompleteListener { frame.close() }
    } catch (error: Exception) {
      frame.close()
      promise.reject(PoseFailedException(error))
    }
  }

  private fun poseResult(
    pose: Pose,
    width: Int,
    height: Int,
  ): Map<String, Any> =
    mapOf(
      "width" to width,
      "height" to height,
      // 사람을 찾지 못하면 빈 목록이다.
      "landmarks" to
        pose.allPoseLandmarks.mapNotNull { landmark ->
          LANDMARK_NAMES[landmark.landmarkType]?.let { name ->
            mapOf(
              "name" to name,
              "x" to (if (mirrored) width - landmark.position.x else landmark.position.x).toDouble(),
              "y" to landmark.position.y.toDouble(),
              "likelihood" to landmark.inFrameLikelihood.toDouble(),
            )
          }
        },
    )

  private fun fail(error: CodedException) {
    onCameraError(mapOf("code" to error.code, "message" to (error.message ?: "")))
  }

  private fun facingOf(info: CameraInfo): String =
    when (info.lensFacing) {
      CameraSelector.LENS_FACING_FRONT -> "front"
      CameraSelector.LENS_FACING_BACK -> "back"
      else -> "external"
    }

  private companion object {
    const val CAPTURE_TIMEOUT_MS = 5_000L

    // 자세 인식에는 이 정도면 충분하다. 더 크면 분석만 느려진다.
    val ANALYSIS_SIZE = Size(1280, 960)
    val ASPECT: AspectRatioStrategy = AspectRatioStrategy.RATIO_4_3_FALLBACK_AUTO_STRATEGY

    // JS 계약(src/PoseCamera.types.ts 의 POSE_LANDMARK_NAMES)과 같은 이름이다.
    val LANDMARK_NAMES: Map<Int, String> =
      mapOf(
        PoseLandmark.NOSE to "nose",
        PoseLandmark.LEFT_EYE_INNER to "leftEyeInner",
        PoseLandmark.LEFT_EYE to "leftEye",
        PoseLandmark.LEFT_EYE_OUTER to "leftEyeOuter",
        PoseLandmark.RIGHT_EYE_INNER to "rightEyeInner",
        PoseLandmark.RIGHT_EYE to "rightEye",
        PoseLandmark.RIGHT_EYE_OUTER to "rightEyeOuter",
        PoseLandmark.LEFT_EAR to "leftEar",
        PoseLandmark.RIGHT_EAR to "rightEar",
        PoseLandmark.LEFT_MOUTH to "leftMouth",
        PoseLandmark.RIGHT_MOUTH to "rightMouth",
        PoseLandmark.LEFT_SHOULDER to "leftShoulder",
        PoseLandmark.RIGHT_SHOULDER to "rightShoulder",
        PoseLandmark.LEFT_ELBOW to "leftElbow",
        PoseLandmark.RIGHT_ELBOW to "rightElbow",
        PoseLandmark.LEFT_WRIST to "leftWrist",
        PoseLandmark.RIGHT_WRIST to "rightWrist",
        PoseLandmark.LEFT_PINKY to "leftPinky",
        PoseLandmark.RIGHT_PINKY to "rightPinky",
        PoseLandmark.LEFT_INDEX to "leftIndex",
        PoseLandmark.RIGHT_INDEX to "rightIndex",
        PoseLandmark.LEFT_THUMB to "leftThumb",
        PoseLandmark.RIGHT_THUMB to "rightThumb",
        PoseLandmark.LEFT_HIP to "leftHip",
        PoseLandmark.RIGHT_HIP to "rightHip",
        PoseLandmark.LEFT_KNEE to "leftKnee",
        PoseLandmark.RIGHT_KNEE to "rightKnee",
        PoseLandmark.LEFT_ANKLE to "leftAnkle",
        PoseLandmark.RIGHT_ANKLE to "rightAnkle",
        PoseLandmark.LEFT_HEEL to "leftHeel",
        PoseLandmark.RIGHT_HEEL to "rightHeel",
        PoseLandmark.LEFT_FOOT_INDEX to "leftFootIndex",
        PoseLandmark.RIGHT_FOOT_INDEX to "rightFootIndex",
      )
  }
}
