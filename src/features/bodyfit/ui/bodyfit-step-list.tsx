import { useState } from "react";
import { Pressable, View } from "react-native";

import { AppText } from "@/shared/ui/app-text";
import { IconBadge } from "@/shared/ui/icon-badge";
import { InfoRow } from "@/shared/ui/info-row";
import { radius, sizes, spacing } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

import { groupSeatAxes } from "../model/bodyfit-axis-group";
import type { SeatAxis } from "../model/bodyfit.types";
import { BodyfitAxisGroupHeading } from "./bodyfit-axis-group-heading";

export type BodyfitStep = {
  axis: SeatAxis;
  /** 맞추는 순서 (1부터) */
  step: number;
  /** 축 이름 */
  label: string;
  /** 지금 상태 한마디 (예: "조금 더 세워 주세요", "맞췄어요") */
  value: string;
  /** 숫자 한 줄 (예: "지금 38% · 목표 52%") */
  detail: string;
  accessibilityLabel: string;
  /** done: 맞춘 곳, active: 지금 하는 곳, issue: 멈췄거나 실패한 곳, todo: 아직 차례가 아닌 곳 */
  state: "done" | "active" | "issue" | "todo";
  /** 지금 위치(회색 점)와 목표(파란 점)를 막대로도 보여 줄 때. 지금 하는 곳·문제가 생긴 곳에만 그린다 */
  track?: { current: number; target: number };
};

type BodyfitStepListProps = {
  steps: readonly BodyfitStep[];
  /** 접어 둔 줄의 이름 (예: "맞춘 곳", "남은 곳"). 뒤에 "N곳 보기" 가 붙는다 */
  doneNoun: string;
  todoNoun: string;
};

// 이 개수부터 접는다. 기본 네 축만 있는 차량은 한 화면에 다 들어가므로 그대로 펼쳐 둔다.
const FOLD_FROM = 5;

const percent = (ratio: number) => Math.round(ratio * 100);

const badgeOf = (step: BodyfitStep) =>
  ({
    done: { glyph: "✓", tone: "success" },
    active: { glyph: `${step.step}`, tone: "primary" },
    issue: { glyph: "!", tone: "warning" },
    todo: { glyph: `${step.step}`, tone: "muted" },
  })[step.state] as {
    glyph: string;
    tone: "success" | "primary" | "warning" | "muted";
  };

/**
 * 축이 아홉 개까지 늘어도 한 화면에 들어오는 단계 목록.
 * 지금 하는 곳만 크게, 다음 한 곳은 한 줄로 보여 주고, 맞춘 곳과 남은 곳은 눌러서 펼치는 줄로 접는다.
 */
export function BodyfitStepList({
  steps,
  doneNoun,
  todoNoun,
}: BodyfitStepListProps) {
  const styles = useStyles();
  const [doneOpen, setDoneOpen] = useState(false);
  const [todoOpen, setTodoOpen] = useState(false);

  const full = (step: BodyfitStep) => {
    const badge = badgeOf(step);
    const active = step.state === "active";
    return (
      <View key={step.axis} style={[styles.step, active && styles.stepActive]}>
        <InfoRow
          icon={<IconBadge glyph={badge.glyph} tone={badge.tone} />}
          label={step.label}
          value={step.value}
          valueTone={active ? "accent" : "default"}
          detail={step.detail}
          accessibilityLabel={step.accessibilityLabel}
        />
        {step.track && (active || step.state === "issue") ? (
          // 회색 점(지금)이 파란 점(목표)으로 다가간다. 값은 위의 숫자가 함께 전한다.
          <View style={styles.track} accessible={false}>
            <View
              style={[
                styles.marker,
                styles.current,
                { left: `${percent(step.track.current)}%` },
              ]}
            />
            <View
              style={[
                styles.marker,
                styles.target,
                { left: `${percent(step.track.target)}%` },
              ]}
            />
          </View>
        ) : null}
      </View>
    );
  };

  if (steps.length < FOLD_FROM) {
    return <View style={styles.list}>{steps.map(full)}</View>;
  }

  const compact = (step: BodyfitStep, prefix?: string) => {
    const badge = badgeOf(step);
    return (
      <View
        key={step.axis}
        style={styles.compact}
        accessible
        accessibilityLabel={
          prefix
            ? `${prefix}, ${step.accessibilityLabel}`
            : step.accessibilityLabel
        }
      >
        <IconBadge glyph={badge.glyph} tone={badge.tone} />
        {prefix ? (
          <AppText variant="caption" tone="tertiary">
            {prefix}
          </AppText>
        ) : null}
        <AppText variant="bodyStrong" style={styles.grow}>
          {step.label}
        </AppText>
        <AppText variant="caption" tone="tertiary">
          {step.value}
        </AppText>
      </View>
    );
  };

  // 펼친 줄 안에서는 "자세 / 머리·벨트" 묶음 제목을 그대로 쓴다 (묶음이 둘 이상일 때만).
  const expanded = (items: readonly BodyfitStep[]) => {
    const groups = groupSeatAxes(items);
    return (
      <View style={styles.expanded}>
        {groups.map((group, index) => (
          <View key={group.id} style={styles.list}>
            {groups.length > 1 ? (
              <BodyfitAxisGroupHeading
                group={group.id}
                note={`${group.items.length}곳`}
                divided={index > 0}
              />
            ) : null}
            {group.items.map((step) => compact(step))}
          </View>
        ))}
      </View>
    );
  };

  // 한 곳뿐이면 접지 않고 한 줄로 보여 준다 (누를 일을 만들지 않는다).
  const fold = (
    items: readonly BodyfitStep[],
    noun: string,
    glyph: string,
    tone: "success" | "muted",
    open: boolean,
    toggle: () => void,
  ) => {
    if (items.length === 0) return null;
    if (items.length === 1) return compact(items[0]);
    const text = `${noun} ${items.length}곳 ${open ? "접기" : "보기"}`;
    return (
      <>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={text}
          onPress={toggle}
          style={({ pressed }) => [styles.fold, pressed && styles.foldPressed]}
        >
          <IconBadge glyph={glyph} tone={tone} />
          <AppText variant="bodyStrong" style={styles.grow}>
            {text}
          </AppText>
          {/* 펼침 여부는 글자("보기 / 접기")와 화살표 방향이 함께 전한다 */}
          <AppText variant="heading" tone="tertiary">
            {open ? "▴" : "▾"}
          </AppText>
        </Pressable>
        {open ? expanded(items) : null}
      </>
    );
  };

  const done = steps.filter((step) => step.state === "done");
  const now = steps.filter(
    (step) => step.state === "active" || step.state === "issue",
  );
  const [next, ...rest] = steps.filter((step) => step.state === "todo");

  return (
    <View style={styles.list}>
      {fold(done, doneNoun, "✓", "success", doneOpen, () =>
        setDoneOpen((open) => !open),
      )}
      {now.map(full)}
      {next ? compact(next, now.length > 0 ? "다음" : undefined) : null}
      {fold(rest, todoNoun, `+${rest.length}`, "muted", todoOpen, () =>
        setTodoOpen((open) => !open),
      )}
    </View>
  );
}

const TRACK_HEIGHT = 8;
const DOT = 28;

const useStyles = themedStyles((colors) => ({
  list: { gap: spacing.xs },
  grow: { flex: 1 },
  step: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.control,
  },
  // 지금 하는 곳은 옅은 파란 면과 번호 원 색으로 함께 표시한다.
  stepActive: { backgroundColor: colors.primaryTint },
  compact: {
    minHeight: sizes.touchTarget,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  // 접힌 줄은 누르는 것임이 보이게 보조 버튼과 같은 테두리를 두른다.
  fold: {
    minHeight: sizes.touchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.control,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  // Pleos 인터랙션 가이드: 눌린 요소는 줄이고 배경색을 바꾼다.
  foldPressed: {
    backgroundColor: colors.surfaceMuted,
    transform: [{ scale: 0.98 }],
  },
  expanded: { gap: spacing.sm, paddingBottom: spacing.xs },
  track: {
    height: TRACK_HEIGHT,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    // 점이 양 끝에서 잘리지 않게 점 반지름만큼 안쪽에 둔다
    marginHorizontal: DOT / 2,
    borderRadius: radius.pill,
    // 옅은 파란 면(지금 하는 곳) 위에서도 보이게 fill 보다 진한 선 색을 쓴다.
    backgroundColor: colors.lineStrong,
  },
  marker: {
    position: "absolute",
    top: (TRACK_HEIGHT - DOT) / 2,
    width: DOT,
    height: DOT,
    marginLeft: -DOT / 2,
    borderRadius: radius.pill,
  },
  current: { backgroundColor: colors.inkDisabled },
  target: { backgroundColor: colors.primary },
}));
