package ai.mobi.pleosconnect

import ai.pleos.playground.vehicle.api.Seat
import ai.pleos.playground.vehicle.api.model.area.SeatArea
import ai.pleos.playground.vehicle.api.model.capability.AccessType
import ai.pleos.playground.vehicle.api.model.capability.AreaBounds
import ai.pleos.playground.vehicle.api.model.capability.CapabilityConfig
import ai.pleos.playground.vehicle.constant.area.SeatValue
import ai.pleos.playground.vehicle.constant.control.MoveControl
import ai.pleos.playground.vehicle.listener.SeatBackrestAnglePositionListener
import ai.pleos.playground.vehicle.listener.SeatBeltHeightPositionListener
import ai.pleos.playground.vehicle.listener.SeatDepthPositionListener
import ai.pleos.playground.vehicle.listener.SeatForeAftPositionListener
import ai.pleos.playground.vehicle.listener.SeatHeadrestHeightAftPositionListener
import ai.pleos.playground.vehicle.listener.SeatHeightPositionListener
import ai.pleos.playground.vehicle.listener.SeatOccupancyListener
import ai.pleos.playground.vehicle.listener.SeatTiltPositionListener
import expo.modules.kotlin.types.Enumerable
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.job
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.math.abs
import kotlin.math.max

enum class SeatAxis(val value: String) : Enumerable {
  FORE_AFT("foreAft"),
  HEIGHT("height"),
  BACKREST("backrest"),
  TILT("tilt"),

  // 좌판 길이·헤드레스트 높이·안전벨트 높이. 전동이 아닌 차량이 많아 없는 축으로 나오는 일이 흔하다.
  // 기본 자세(위 네 축)를 잡은 뒤에 맞추도록 순서를 뒤에 둔다. 헤드레스트 각도·앞뒤는 체형으로 정할 수 없어 다루지 않는다.
  DEPTH("depth"),
  HEADREST_HEIGHT("headrestHeight"),
  BELT_HEIGHT("beltHeight"),
}

// 운전석(좌핸들 기준 1열 왼쪽). Pleos SDK 는 "앞/뒤로 움직이기·멈추기" 만 제공하므로
// 목표 위치까지는 위치 알림을 받으며 움직이다가 직접 멈춘다.
// SDK 콜백의 Kotlin 타입(널 허용 여부)은 문서에 없어서, 콜백 람다는 넓은 타입(널 허용)으로 선언해 어느 쪽이든 받게 한다.
class DriverSeat(
  private val seat: Seat,
  private val gear: GearMonitor,
  private val onOccupancyChanged: (Boolean) -> Unit,
  private val onPositionChanged: (SeatAxis, Int) -> Unit,
) {
  private val driver = SeatArea(SeatValue.ROW_1_LEFT)
  private val moveLock = Mutex()

  @Volatile
  private var activeMove: Job? = null
  private var observingOccupancy = false
  private val positionSubscriptions = mutableListOf<Subscription>()

  private val occupancyListener =
    object : SeatOccupancyListener {
      override fun onSeatOccupancyUpdated(occupied: Boolean?) {
        occupied?.let(onOccupancyChanged)
      }

      override fun onFailed(e: Exception) = Unit
    }

  suspend fun readState(): Map<String, Map<String, Any>> {
    val state = mutableMapOf<String, Map<String, Any>>()
    for (axis in SeatAxis.entries) {
      // 차량마다 지원하는 축이 다르다. 읽을 수 없는 축은 결과에서 뺀다.
      val range = orNull { bounds(axis) } ?: continue
      val value = orNull { position(axis) } ?: continue
      state[axis.value] =
        mapOf(
          "value" to value,
          "min" to range.first,
          "max" to range.last,
          "movable" to (orNull { canMove(axis) } ?: false),
        )
    }
    return state
  }

  suspend fun moveTo(axis: SeatAxis, target: Int): Int =
    moveLock.withLock {
      activeMove = currentCoroutineContext().job
      try {
        moveLocked(axis, target)
      } finally {
        activeMove = null
      }
    }

  suspend fun stopAll() {
    activeMove?.cancel()
    for (axis in SeatAxis.entries) orNull { sendMove(axis, MoveControl.STOP) }
  }

  // 모듈이 내려갈 때(suspend 불가)·앱이 화면에서 사라질 때 쓴다. Vehicle.release() 전에 STOP 이 전달되도록
  // 응답을 잠깐 기다린다. 콜백이 같은 스레드로 오면 기다리지 못하므로 시간 제한을 둔다.
  fun stopAllBlocking(timeoutMs: Long) {
    activeMove?.cancel()
    val pending = CountDownLatch(SeatAxis.entries.size)
    for (axis in SeatAxis.entries) {
      try {
        requestMove(axis, MoveControl.STOP, { pending.countDown() }, { pending.countDown() })
      } catch (e: Exception) {
        pending.countDown()
      }
    }
    pending.await(timeoutMs, TimeUnit.MILLISECONDS)
  }

  suspend fun isOccupied(): Boolean =
    suspendPleos<Boolean?> { resume, fail ->
      seat.getCurrentSeatOccupancy(driver, { occupied: Boolean? -> resume(occupied) }, { e: Throwable? -> fail(e) })
    } ?: false

  @Synchronized
  fun startOccupancyObserving() {
    if (observingOccupancy) return
    seat.registerSeatOccupancy(driver, occupancyListener)
    observingOccupancy = true
  }

  @Synchronized
  fun stopOccupancyObserving() {
    if (!observingOccupancy) return
    seat.unregisterSeatOccupancy(driver, occupancyListener)
    observingOccupancy = false
  }

  // 가이드 조절: 운전자가 시트 버튼으로 움직이는 동안 축별 위치를 알린다. 조회만 하므로 CAR_SEATS 권한이면 된다.
  @Synchronized
  fun startPositionObserving() {
    if (positionSubscriptions.isNotEmpty()) return
    for (axis in SeatAxis.entries) {
      val subscription = subscribePosition(axis, onValue = { onPositionChanged(axis, it) }, onError = {})
      // 차량이 지원하지 않는 축은 등록이 실패할 수 있다. 나머지 축은 계속 알린다.
      if (runCatching { subscription.register() }.isSuccess) positionSubscriptions += subscription
    }
  }

  @Synchronized
  fun stopPositionObserving() {
    for (subscription in positionSubscriptions) runCatching { subscription.unregister() }
    positionSubscriptions.clear()
  }

  private suspend fun moveLocked(axis: SeatAxis, target: Int): Int {
    if (!gear.isParked()) throw NotParkedException()
    val range = bounds(axis) ?: throw SeatUnsupportedException(axis)
    if (!canMove(axis)) throw SeatUnsupportedException(axis)

    val goal = target.coerceIn(range)
    val tolerance = max(1, (range.last - range.first) / 100)
    val start = position(axis) ?: throw SeatMoveFailedException("현재 시트 위치를 읽지 못했습니다")
    if (abs(goal - start) <= tolerance) return start

    val direction = if (goal > start) MoveControl.FORWARD else MoveControl.BACKWARD
    val updates = Channel<Int>(Channel.CONFLATED)
    val subscription =
      subscribePosition(
        axis,
        onValue = { updates.trySend(it) },
        onError = { updates.close(PleosServiceException("시트 위치 알림을 받지 못했습니다", it)) },
      )
    subscription.register()
    try {
      sendMove(axis, direction)
      return withTimeout(MOVE_TIMEOUT_MS) { followUntil(goal, start, direction, tolerance, updates) }
    } catch (e: TimeoutCancellationException) {
      throw SeatMoveFailedException("시트가 ${MOVE_TIMEOUT_MS / 1000}초 안에 목표 위치에 닿지 않았습니다", e)
    } finally {
      // 취소·실패·성공 어느 경우든 반드시 멈춘다.
      withContext(NonCancellable) {
        orNull { sendMove(axis, MoveControl.STOP) }
        // 모듈 종료로 Vehicle 이 먼저 해제됐을 수 있다. 해제 실패로 STOP 결과를 덮지 않는다.
        runCatching { subscription.unregister() }
      }
    }
  }

  // FORWARD 가 위치 값을 키운다고 가정한다(AAOS 시트 속성 규약). 차량이 반대로 보고하면 멀어지는 것을 감지해 멈춘다.
  private suspend fun followUntil(
    goal: Int,
    start: Int,
    direction: MoveControl,
    tolerance: Int,
    updates: Channel<Int>,
  ): Int {
    var closest = abs(goal - start)
    var awaySteps = 0
    for (position in updates) {
      if (!gear.isParked()) throw NotParkedException()
      val remaining = if (direction == MoveControl.FORWARD) goal - position else position - goal
      if (remaining <= tolerance) return position
      val distance = abs(goal - position)
      if (distance < closest) {
        closest = distance
        awaySteps = 0
      } else if (distance > closest && ++awaySteps >= AWAY_LIMIT) {
        throw SeatMoveFailedException("시트가 목표와 반대 방향으로 움직여 멈췄습니다")
      }
    }
    throw SeatMoveFailedException("시트 위치 알림이 끊겼습니다")
  }

  private suspend fun position(axis: SeatAxis): Int? =
    suspendPleos { resume, fail ->
      val done = { value: Int? -> resume(value) }
      val failed = { e: Throwable? -> fail(e) }
      when (axis) {
        SeatAxis.FORE_AFT -> seat.getCurrentSeatForeAftPosition(driver, done, failed)
        SeatAxis.HEIGHT -> seat.getCurrentSeatHeightPosition(driver, done, failed)
        SeatAxis.BACKREST -> seat.getCurrentSeatBackrestAnglePosition(driver, done, failed)
        SeatAxis.TILT -> seat.getCurrentSeatTiltPosition(driver, done, failed)
        SeatAxis.DEPTH -> seat.getCurrentSeatDepthPosition(driver, done, failed)
        // SDK 2.3.2 의 헤드레스트 높이 조회·알림 이름에는 "HeightAft" 가 붙어 있다 (AAR 확인, 값은 SEAT_HEADREST_HEIGHT_POS_V2).
        SeatAxis.HEADREST_HEIGHT -> seat.getCurrentSeatHeadrestHeightAftPosition(driver, done, failed)
        SeatAxis.BELT_HEIGHT -> seat.getCurrentSeatBeltHeightPosition(driver, done, failed)
      }
    }

  private suspend fun bounds(axis: SeatAxis): IntRange? =
    suspendPleos { resume, fail ->
      val done = { config: CapabilityConfig?, areas: Map<out SeatArea?, AreaBounds<*>?>? ->
        resume(driverRange(config, areas))
      }
      val failed = { e: Throwable? -> fail(e) }
      when (axis) {
        SeatAxis.FORE_AFT -> seat.checkSeatForeAftPositionCapabilities(done, failed)
        SeatAxis.HEIGHT -> seat.checkSeatHeightPositionCapabilities(done, failed)
        SeatAxis.BACKREST -> seat.checkSeatBackrestAnglePositionCapabilities(done, failed)
        SeatAxis.TILT -> seat.checkSeatTiltPositionCapabilities(done, failed)
        SeatAxis.DEPTH -> seat.checkSeatDepthPositionCapabilities(done, failed)
        SeatAxis.HEADREST_HEIGHT -> seat.checkSeatHeadrestHeightPositionCapabilities(done, failed)
        SeatAxis.BELT_HEIGHT -> seat.checkSeatBeltHeightPositionCapabilities(done, failed)
      }
    }

  private suspend fun canMove(axis: SeatAxis): Boolean =
    suspendPleos { resume, fail ->
      val done = { config: CapabilityConfig?, areas: List<SeatArea?>? ->
        resume(config.isWritable() && areas.orEmpty().any { it.isDriver() })
      }
      val failed = { e: Throwable? -> fail(e) }
      when (axis) {
        SeatAxis.FORE_AFT -> seat.checkMoveSeatForeAftCapabilities(done, failed)
        SeatAxis.HEIGHT -> seat.checkMoveSeatHeightCapabilities(done, failed)
        SeatAxis.BACKREST -> seat.checkMoveSeatBackrestAngleCapabilities(done, failed)
        SeatAxis.TILT -> seat.checkMoveSeatTiltCapabilities(done, failed)
        SeatAxis.DEPTH -> seat.checkMoveSeatDepthCapabilities(done, failed)
        SeatAxis.HEADREST_HEIGHT -> seat.checkMoveSeatHeadrestHeightCapabilities(done, failed)
        SeatAxis.BELT_HEIGHT -> seat.checkMoveSeatBeltHeightCapabilities(done, failed)
      }
    }

  private suspend fun sendMove(axis: SeatAxis, control: MoveControl) =
    suspendPleos<Unit> { resume, fail -> requestMove(axis, control, { resume(Unit) }, fail) }

  private fun requestMove(
    axis: SeatAxis,
    control: MoveControl,
    onDone: () -> Unit,
    onFailed: (Throwable?) -> Unit,
  ) {
    val done = { _: SeatArea?, _: MoveControl? -> onDone() }
    val failed = { e: Throwable? -> onFailed(e) }
    when (axis) {
      SeatAxis.FORE_AFT -> seat.moveSeatForeAft(driver, control, done, failed)
      SeatAxis.HEIGHT -> seat.moveSeatHeight(driver, control, done, failed)
      SeatAxis.BACKREST -> seat.moveSeatBackrestAngle(driver, control, done, failed)
      SeatAxis.TILT -> seat.moveSeatTilt(driver, control, done, failed)
      SeatAxis.DEPTH -> seat.moveSeatDepth(driver, control, done, failed)
      SeatAxis.HEADREST_HEIGHT -> seat.moveSeatHeadrestHeight(driver, control, done, failed)
      SeatAxis.BELT_HEIGHT -> seat.moveSeatBeltHeight(driver, control, done, failed)
    }
  }

  private class Subscription(val register: () -> Unit, val unregister: () -> Unit)

  private fun subscribePosition(
    axis: SeatAxis,
    onValue: (Int) -> Unit,
    onError: (Exception) -> Unit,
  ): Subscription =
    when (axis) {
      SeatAxis.FORE_AFT -> {
        val listener =
          object : SeatForeAftPositionListener {
            override fun onSeatForeAftPositionUpdated(position: Int?) {
              position?.let(onValue)
            }

            override fun onFailed(e: Exception) = onError(e)
          }
        Subscription(
          { seat.registerSeatForeAftPosition(driver, listener) },
          { seat.unregisterSeatForeAftPosition(driver, listener) },
        )
      }
      SeatAxis.HEIGHT -> {
        val listener =
          object : SeatHeightPositionListener {
            override fun onSeatHeightPositionUpdated(position: Int?) {
              position?.let(onValue)
            }

            override fun onFailed(e: Exception) = onError(e)
          }
        Subscription(
          { seat.registerSeatHeightPosition(driver, listener) },
          { seat.unregisterSeatHeightPosition(driver, listener) },
        )
      }
      SeatAxis.BACKREST -> {
        val listener =
          object : SeatBackrestAnglePositionListener {
            override fun onSeatBackrestAnglePositionUpdated(position: Int?) {
              position?.let(onValue)
            }

            override fun onFailed(e: Exception) = onError(e)
          }
        Subscription(
          { seat.registerSeatBackrestAnglePosition(driver, listener) },
          { seat.unregisterSeatBackrestAnglePosition(driver, listener) },
        )
      }
      SeatAxis.TILT -> {
        val listener =
          object : SeatTiltPositionListener {
            override fun onSeatTiltPositionUpdated(position: Int?) {
              position?.let(onValue)
            }

            override fun onFailed(e: Exception) = onError(e)
          }
        Subscription(
          { seat.registerSeatTiltPosition(driver, listener) },
          { seat.unregisterSeatTiltPosition(driver, listener) },
        )
      }
      SeatAxis.DEPTH -> {
        val listener =
          object : SeatDepthPositionListener {
            override fun onSeatDepthPositionUpdated(position: Int?) {
              position?.let(onValue)
            }

            override fun onFailed(e: Exception) = onError(e)
          }
        Subscription(
          { seat.registerSeatDepthPosition(driver, listener) },
          { seat.unregisterSeatDepthPosition(driver, listener) },
        )
      }
      SeatAxis.HEADREST_HEIGHT -> {
        val listener =
          object : SeatHeadrestHeightAftPositionListener {
            override fun onSeatHeadrestHeightAftPositionUpdated(position: Int?) {
              position?.let(onValue)
            }

            override fun onFailed(e: Exception) = onError(e)
          }
        Subscription(
          { seat.registerSeatHeadrestHeightAftPosition(driver, listener) },
          { seat.unregisterSeatHeadrestHeightAftPosition(driver, listener) },
        )
      }
      SeatAxis.BELT_HEIGHT -> {
        val listener =
          object : SeatBeltHeightPositionListener {
            override fun onSeatBeltHeightPositionUpdated(position: Int?) {
              position?.let(onValue)
            }

            override fun onFailed(e: Exception) = onError(e)
          }
        Subscription(
          { seat.registerSeatBeltHeightPosition(driver, listener) },
          { seat.unregisterSeatBeltHeightPosition(driver, listener) },
        )
      }
    }

  private fun driverRange(
    config: CapabilityConfig?,
    areas: Map<out SeatArea?, AreaBounds<*>?>?,
  ): IntRange? {
    if (config?.accessType == AccessType.NONE) return null
    val bounds = areas?.entries?.firstOrNull { it.key.isDriver() }?.value ?: return null
    val a = bounds.minValue as? Int ?: return null
    val b = bounds.maxValue as? Int ?: return null
    return minOf(a, b)..maxOf(a, b)
  }

  private fun SeatArea?.isDriver(): Boolean = this?.values?.contains(SeatValue.ROW_1_LEFT) == true

  private fun CapabilityConfig?.isWritable(): Boolean =
    this?.accessType == AccessType.WRITE || this?.accessType == AccessType.READ_WRITE

  private companion object {
    const val MOVE_TIMEOUT_MS = 30_000L
    const val AWAY_LIMIT = 3
  }
}

// Pleos 콜백 API 를 suspend 함수로 바꾼다. 콜백이 여러 번 와도 첫 번째만 반영한다.
internal suspend fun <T> suspendPleos(call: (resume: (T) -> Unit, fail: (Throwable?) -> Unit) -> Unit): T =
  suspendCancellableCoroutine { cont ->
    call(
      { value -> if (cont.isActive) cont.resume(value) },
      { error -> if (cont.isActive) cont.resumeWithException(pleosFailure(error)) },
    )
  }

// 일부 축·기능이 없는 차량이 있어 실패를 null 로 바꾼다. 취소는 그대로 전파한다.
internal suspend fun <T> orNull(block: suspend () -> T): T? =
  try {
    block()
  } catch (e: CancellationException) {
    throw e
  } catch (e: Exception) {
    null
  }
