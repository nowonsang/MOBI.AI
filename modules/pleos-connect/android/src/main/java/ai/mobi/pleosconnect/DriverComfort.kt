package ai.mobi.pleosconnect

import ai.pleos.playground.vehicle.api.HVAC
import ai.pleos.playground.vehicle.api.Seat
import ai.pleos.playground.vehicle.api.SteeringWheel
import ai.pleos.playground.vehicle.api.model.area.SeatArea
import ai.pleos.playground.vehicle.api.model.capability.AccessType
import ai.pleos.playground.vehicle.api.model.capability.AreaBounds
import ai.pleos.playground.vehicle.api.model.capability.CapabilityConfig
import ai.pleos.playground.vehicle.api.model.capability.HvacTemperatureConfigArray
import ai.pleos.playground.vehicle.constant.area.SeatValue
import ai.pleos.playground.vehicle.constant.control.FanDirectionType
import ai.pleos.playground.vehicle.constant.unit.TemperatureUnit
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.Enumerable
import kotlin.math.roundToInt

// 바람이 나오는 곳. JS 의 FanDirection 과 맞춘다 (face = 얼굴, floor = 발, defrost = 앞유리).
enum class FanDirection(val value: String) : Enumerable {
  FACE("face"),
  FLOOR("floor"),
  FACE_FLOOR("faceFloor"),
  DEFROST("defrost"),
  FACE_DEFROST("faceDefrost"),
  FLOOR_DEFROST("floorDefrost"),
  FACE_FLOOR_DEFROST("faceFloorDefrost"),
}

// SDK 의 UNKNOWN 은 짝이 없다: 읽지 못한 것으로 보고 뺀다.
private val FAN_DIRECTION_TYPES =
  mapOf(
    FanDirection.FACE to FanDirectionType.FACE,
    FanDirection.FLOOR to FanDirectionType.FLOOR,
    FanDirection.FACE_FLOOR to FanDirectionType.FACE_AND_FLOOR,
    FanDirection.DEFROST to FanDirectionType.DEFROST,
    FanDirection.FACE_DEFROST to FanDirectionType.FACE_AND_DEFROST,
    FanDirection.FLOOR_DEFROST to FanDirectionType.DEFROST_AND_FLOOR,
    FanDirection.FACE_FLOOR_DEFROST to FanDirectionType.FACE_AND_FLOOR_AND_DEFROST,
  )

private fun FanDirectionType?.toFanDirection(): FanDirection? =
  FAN_DIRECTION_TYPES.entries.firstOrNull { it.value == this }?.key

// 운전석 온도 취향: 시트 열선·통풍, 핸들 열선, 운전석 공조 설정 온도, 풍량, 바람 방향, 지금 실내 온도.
// 값의 범위·단계는 차종마다 달라서 원시 값과 범위를 함께 넘기고, JS 는 범위 안에서만 다룬다.
// 시트 열선 값은 AAOS 규약대로 음수 = 냉각, 0 = 꺼짐, 양수 = 열선 단계다. 통풍은 별도 값(HVAC_SEAT_VENTILATION, 0 = 꺼짐)이다.
class ComfortSettings : Record {
  @Field var seatHeat: Int? = null

  @Field var seatVent: Int? = null

  @Field var steeringHeat: Int? = null

  @Field var cabinTarget: Double? = null

  @Field var fanSpeed: Int? = null

  @Field var fanDirection: FanDirection? = null
}

class DriverComfort(
  private val seat: Seat,
  private val steering: SteeringWheel,
  private val hvac: HVAC,
  private val gear: GearMonitor,
) {
  private val driver = SeatArea(SeatValue.ROW_1_LEFT)

  // 차량마다 지원하는 항목이 다르다. 읽을 수 없는 항목은 결과에서 뺀다.
  suspend fun readState(): Map<String, Any> {
    val state = mutableMapOf<String, Any>()
    orNull { seatHeatRange() }?.let { range ->
      orNull { seatHeat() }?.let { state["seatHeat"] = level(it, range) }
    }
    orNull { seatVentRange() }?.let { range ->
      orNull { seatVent() }?.let { state["seatVent"] = level(it, range) }
    }
    orNull { steeringHeatRange() }?.let { range ->
      orNull { steeringHeat() }?.let { state["steeringHeat"] = level(it, range) }
    }
    orNull { cabinTargetRange() }?.let { (area, range) ->
      orNull { cabinTarget(area) }?.let {
        state["cabinTarget"] =
          mapOf("value" to it.toDouble(), "min" to range.start.toDouble(), "max" to range.endInclusive.toDouble())
      }
      orNull { cabinCurrent(area) }?.let { state["cabinCurrent"] = it.toDouble() }
    }
    orNull { fanSpeedRange() }?.let { (area, range) ->
      orNull { fanSpeed(area) }?.let { state["fanSpeed"] = level(it, range) }
    }
    orNull { fanDirections() }?.let { (area, options) ->
      orNull { fanDirection(area) }?.let {
        state["fanDirection"] = mapOf("value" to it.value, "options" to options.map { option -> option.value })
      }
    }
    if ("fanSpeed" in state || "fanDirection" in state) state["fanMode"] = fanMode()
    return state
  }

  // 주차(P) 중에 화면에서 운전자가 누를 때만 쓴다. 기어를 알 수 없으면 바꾸지 않는다.
  // 범위 밖 값은 차량 범위로 맞춰 보낸다. 바꾼 뒤의 상태를 돌려준다.
  suspend fun apply(settings: ComfortSettings): Map<String, Any> {
    if (!gear.isParked()) throw NotParkedException()
    settings.seatHeat?.let { wanted ->
      val range = seatHeatRange() ?: throw PleosServiceException("이 차량은 시트 열선을 지원하지 않습니다")
      suspendPleos<Unit> { resume, fail ->
        seat.setHvacSeatTemperature(
          driver,
          wanted.coerceIn(range),
          { _: SeatArea?, _: Int? -> resume(Unit) },
          { e: Throwable? -> fail(e) },
        )
      }
    }
    settings.seatVent?.let { wanted ->
      val range = seatVentRange() ?: throw PleosServiceException("이 차량은 시트 통풍을 지원하지 않습니다")
      suspendPleos<Unit> { resume, fail ->
        seat.setHvacSeatVentilation(
          driver,
          wanted.coerceIn(range),
          { _: SeatArea?, _: Int? -> resume(Unit) },
          { e: Throwable? -> fail(e) },
        )
      }
    }
    settings.steeringHeat?.let { wanted ->
      val range = steeringHeatRange() ?: throw PleosServiceException("이 차량은 핸들 열선을 지원하지 않습니다")
      suspendPleos<Unit> { resume, fail ->
        steering.setHvacSteeringWheelHeat(
          wanted.coerceIn(range),
          { _: Int? -> resume(Unit) },
          { e: Throwable? -> fail(e) },
        )
      }
    }
    settings.cabinTarget?.let { wanted ->
      val (area, range) = cabinTargetRange() ?: throw PleosServiceException("이 차량은 공조 온도 설정을 지원하지 않습니다")
      suspendPleos<Unit> { resume, fail ->
        hvac.setHvacTemperature(
          area,
          wanted.toFloat().coerceIn(range),
          TemperatureUnit.CELSIUS,
          { _: SeatArea?, _: Float? -> resume(Unit) },
          { e: Throwable? -> fail(e) },
        )
      }
    }
    // 공조가 꺼져 있거나 자동(AUTO)이면 풍량·바람 방향은 차가 정한다. 수동 값을 보내면 공조가 켜지거나 자동이 풀리므로 그대로 둔다.
    // JS 도 같은 기준으로 거르지만, 화면이 상태를 읽은 뒤에 운전자가 AUTO 를 눌렀을 수 있어 보내기 직전에 다시 본다.
    if ((settings.fanSpeed != null || settings.fanDirection != null) && fanMode() == FAN_MANUAL) {
      settings.fanSpeed?.let { wanted ->
        val (area, range) = fanSpeedRange() ?: throw PleosServiceException("이 차량은 풍량 조절을 지원하지 않습니다")
        suspendPleos<Unit> { resume, fail ->
          hvac.setHvacFanSpeed(
            area,
            wanted.coerceIn(range),
            { _: SeatArea?, _: Int? -> resume(Unit) },
            { e: Throwable? -> fail(e) },
          )
        }
      }
      settings.fanDirection?.let { wanted ->
        val (area, options) = fanDirections() ?: throw PleosServiceException("이 차량은 바람 방향 조절을 지원하지 않습니다")
        // 이 차량에 없는 방향(예: 앞유리 겸용이 없는 차)은 보내지 않는다.
        val type = FAN_DIRECTION_TYPES[wanted]
        if (type != null && wanted in options) {
          suspendPleos<Unit> { resume, fail ->
            hvac.setHvacFanDirection(
              area,
              type,
              { _: SeatArea?, _: FanDirectionType? -> resume(Unit) },
              { e: Throwable? -> fail(e) },
            )
          }
        }
      }
    }
    return readState()
  }

  private suspend fun seatHeat(): Int? =
    suspendPleos { resume, fail ->
      seat.getHvacSeatTemperature(driver, { value: Int? -> resume(value) }, { e: Throwable? -> fail(e) })
    }

  private suspend fun seatHeatRange(): IntRange? =
    suspendPleos { resume, fail ->
      seat.checkSeatTemperatureCapabilities(
        { config: CapabilityConfig?, areas: Map<out SeatArea?, AreaBounds<*>?>? ->
          resume(if (config.isReadable()) intRange(areas?.entries?.firstOrNull { it.key.isDriver() }?.value) else null)
        },
        { e: Throwable? -> fail(e) },
      )
    }

  private suspend fun seatVent(): Int? =
    suspendPleos { resume, fail ->
      seat.getHvacSeatVentilationState(driver, { value: Int? -> resume(value) }, { e: Throwable? -> fail(e) })
    }

  private suspend fun seatVentRange(): IntRange? =
    suspendPleos { resume, fail ->
      seat.checkSeatVentilationCapabilities(
        { config: CapabilityConfig?, areas: Map<out SeatArea?, AreaBounds<*>?>? ->
          resume(if (config.isReadable()) intRange(areas?.entries?.firstOrNull { it.key.isDriver() }?.value) else null)
        },
        { e: Throwable? -> fail(e) },
      )
    }

  private suspend fun steeringHeat(): Int? =
    suspendPleos { resume, fail ->
      steering.getHvacSteeringWheelHeatState({ value: Int? -> resume(value) }, { e: Throwable? -> fail(e) })
    }

  private suspend fun steeringHeatRange(): IntRange? =
    suspendPleos { resume, fail ->
      steering.checkHvacSteeringWheelHeatCapabilities(
        { config: CapabilityConfig?, bounds: AreaBounds<*>? ->
          resume(if (config.isReadable()) intRange(bounds) else null)
        },
        { e: Throwable? -> fail(e) },
      )
    }

  // 공조 구역은 차종마다 다르다 (운전석 단독 구역이 없으면 앞좌석 전체 구역). 운전석이 든 구역을 고른다.
  private suspend fun cabinTargetRange(): Pair<SeatArea, ClosedFloatingPointRange<Float>>? =
    suspendPleos { resume, fail ->
      hvac.checkHvacTemperatureCapabilities(
        // 2.3.2 에서 두 인자 버전은 deprecated. 설정 단계 정보(세 번째 인자)는 쓰지 않는다.
        { config: CapabilityConfig?, areas: Map<out SeatArea?, AreaBounds<*>?>?, _: HvacTemperatureConfigArray? ->
          val entry =
            areas?.entries?.firstOrNull { it.key.isDriver() } ?: areas?.entries?.firstOrNull()
          val area = entry?.key
          val a = (entry?.value?.minValue as? Number)?.toFloat()
          val b = (entry?.value?.maxValue as? Number)?.toFloat()
          resume(
            if (config.isReadable() && area != null && a != null && b != null) area to minOf(a, b)..maxOf(a, b) else null,
          )
        },
        { e: Throwable? -> fail(e) },
      )
    }

  private suspend fun cabinTarget(area: SeatArea): Float? =
    suspendPleos { resume, fail ->
      hvac.getHvacTemperature(
        area,
        TemperatureUnit.CELSIUS,
        { value: Float? -> resume(value) },
        { e: Throwable? -> fail(e) },
      )
    }

  private suspend fun cabinCurrent(area: SeatArea): Float? =
    suspendPleos { resume, fail ->
      hvac.getHvacTemperatureCurrent(
        area,
        TemperatureUnit.CELSIUS,
        { value: Float? -> resume(value) },
        { e: Throwable? -> fail(e) },
      )
    }

  // 풍량·바람 방향의 구역도 공조 온도처럼 차종마다 다르다. 운전석이 든 구역, 없으면 첫 구역을 쓴다.
  private suspend fun fanSpeedRange(): Pair<SeatArea, IntRange>? =
    suspendPleos { resume, fail ->
      hvac.checkHvacFanSpeedCapabilities(
        { config: CapabilityConfig?, areas: Map<out SeatArea?, AreaBounds<*>?>? ->
          val entry = areas?.entries?.firstOrNull { it.key.isDriver() } ?: areas?.entries?.firstOrNull()
          val area = entry?.key
          val range = intRange(entry?.value)
          resume(if (config.isReadable() && area != null && range != null) area to range else null)
        },
        { e: Throwable? -> fail(e) },
      )
    }

  private suspend fun fanSpeed(area: SeatArea): Int? =
    suspendPleos { resume, fail ->
      hvac.getHvacFanSpeed(area, { value: Int? -> resume(value) }, { e: Throwable? -> fail(e) })
    }

  private suspend fun fanDirections(): Pair<SeatArea, List<FanDirection>>? =
    suspendPleos { resume, fail ->
      hvac.checkHvacFanDirectionCapabilities(
        { config: CapabilityConfig?, areas: Map<out SeatArea?, List<FanDirectionType?>?>? ->
          val entry = areas?.entries?.firstOrNull { it.key.isDriver() } ?: areas?.entries?.firstOrNull()
          val area = entry?.key
          val options = entry?.value.orEmpty().mapNotNull { it.toFanDirection() }
          resume(if (config.isReadable() && area != null && options.isNotEmpty()) area to options else null)
        },
        { e: Throwable? -> fail(e) },
      )
    }

  private suspend fun fanDirection(area: SeatArea): FanDirection? =
    suspendPleos { resume, fail ->
      hvac.getHvacFanDirection(
        area,
        { value: FanDirectionType? -> resume(value.toFanDirection()) },
        { e: Throwable? -> fail(e) },
      )
    }

  // 풍량·바람 방향을 지금 누가 정하고 있는지: 공조 꺼짐(off), 자동 공조(auto), 운전자(manual).
  // 전원·자동 상태를 읽을 수 없는 차량은 운전자가 정한 것으로 본다.
  private suspend fun fanMode(): String =
    when {
      orNull { powerOn() } == false -> FAN_OFF
      orNull { autoOn() } == true -> FAN_AUTO
      else -> FAN_MANUAL
    }

  private suspend fun powerOn(): Boolean? =
    hvacFlag(
      { done, fail -> hvac.checkHvacPowerCapabilities(done, fail) },
      { area, done, fail -> hvac.getHvacPowerState(area, done, fail) },
    )

  private suspend fun autoOn(): Boolean? =
    hvacFlag(
      { done, fail -> hvac.checkHvacAutoCapabilities(done, fail) },
      { area, done, fail -> hvac.getHvacAutoState(area, done, fail) },
    )

  // 켜짐·꺼짐 값은 "지원 구역 확인 → 그 구역의 값 읽기" 순서가 같다. 지원하지 않으면 null.
  private suspend fun hvacFlag(
    check: ((CapabilityConfig?, List<SeatArea?>?) -> Unit, (Throwable?) -> Unit) -> Unit,
    read: (SeatArea, (Boolean?) -> Unit, (Throwable?) -> Unit) -> Unit,
  ): Boolean? {
    val area =
      suspendPleos<SeatArea?> { resume, fail ->
        check(
          { config, areas ->
            resume(if (config.isReadable()) areas?.firstOrNull { it.isDriver() } ?: areas?.firstOrNull() else null)
          },
          fail,
        )
      } ?: return null
    return suspendPleos { resume, fail -> read(area, resume, fail) }
  }

  private fun level(value: Int, range: IntRange) =
    mapOf("value" to value, "min" to range.first, "max" to range.last)

  private fun intRange(bounds: AreaBounds<*>?): IntRange? {
    val a = (bounds?.minValue as? Number)?.toDouble()?.roundToInt() ?: return null
    val b = (bounds.maxValue as? Number)?.toDouble()?.roundToInt() ?: return null
    return minOf(a, b)..maxOf(a, b)
  }

  private fun SeatArea?.isDriver(): Boolean = this?.values?.contains(SeatValue.ROW_1_LEFT) == true

  private fun CapabilityConfig?.isReadable(): Boolean = this?.accessType != AccessType.NONE

  private companion object {
    const val FAN_MANUAL = "manual"
    const val FAN_AUTO = "auto"
    const val FAN_OFF = "off"
  }
}
