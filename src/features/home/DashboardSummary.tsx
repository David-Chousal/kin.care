import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { hapticImpact, hapticSelection, ImpactFeedbackStyle } from '../../lib/haptics';
import { useFamilyStore } from '../../store/family';
import { useAuthStore } from '../../store/auth';
import { useTasks, useCompleteTask } from '../tasks/hooks/useTasks';
import { useCalendarEvents } from '../calendar/hooks/useCalendarEvents';
import { useCheckIns, useAddCheckIn } from '../checkins/hooks/useCheckIns';
import {
  useMedications, useTodayMedLogs,
  parseMedicationSchedule,
  computeDoseStatusForDate,
  useLogDose,
  scheduledDoseSlotsForDate,
  takenDoseSlotsForDate,
} from '../medications/hooks/useMedications';
import { useFamilyDoctors } from '../doctors/hooks/useFamilyDoctors';
import { useTheme, type Theme, space, typography } from '../../theme';
import { Icon } from '../../components/Icon';
import { VisitPrepGlassPromo } from './VisitPrepGlassPromo';
import { Collapsible, DisclosureChevron } from '../../components/Collapsible';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { CheckInMood, Medication, Task } from '../../types';
import { MOODS, moodMeta } from '../checkins/moods';
import { useFormatLocaleTag } from '../../i18n/useFormatLocaleTag';

function timeAgo(iso: string, tx: (key: string, options?: Record<string, unknown>) => string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return tx('home.dashboardSummary.timeAgo.justNow');
  if (hours < 24) return tx('home.dashboardSummary.timeAgo.hoursAgo', { count: hours });
  return tx('home.dashboardSummary.timeAgo.daysAgo', { count: Math.floor(hours / 24) });
}

function formatGlanceEventDateTime(iso: string, localeTag: string) {
  const d = new Date(iso);
  const datePart = d.toLocaleDateString(localeTag, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timePart = d.toLocaleTimeString(localeTag, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${datePart} · ${timePart}`;
}

function DayProgressBar({ done, total, color }: { done: number; total: number; color: string }) {
  const t = useTheme();
  const pct = total === 0 ? 0 : Math.min(done / total, 1);
  return (
    <View style={{ height: 5, backgroundColor: t.borderLight, borderRadius: 3 }}>
      <View style={{ height: 5, width: `${Math.round(pct * 100)}%`, backgroundColor: color, borderRadius: 3 }} />
    </View>
  );
}

interface Props {
  onNavigate: (view: string) => void;
}

export function DashboardSummary({ onNavigate }: Props) {
  const t = useTheme();
  const styles = makeStyles(t);
  const { t: tx } = useTranslation();
  const localeTag = useFormatLocaleTag();
  const { user } = useAuthStore();
  const family = useFamilyStore((s) => s.family);
  const [medsLogExpanded, setMedsLogExpanded] = useState(true);
  const [tasksCheckExpanded, setTasksCheckExpanded] = useState(true);

  const { data: tasks } = useTasks(family?.id ?? null);
  const { data: events } = useCalendarEvents();
  const { data: checkins } = useCheckIns();
  const { data: medications } = useMedications();
  const { data: doctors } = useFamilyDoctors();
  const { data: todayLogs = {} } = useTodayMedLogs();

  const logDose = useLogDose();
  const completeTask = useCompleteTask(family?.id ?? null);
  const addCheckIn = useAddCheckIn();

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const now = new Date();

  const todayEvents = (events ?? []).filter((e) => {
    const d = new Date(e.starts_at);
    return d >= todayStart && d <= todayEnd;
  });
  const todayEventsSorted = [...todayEvents].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  );

  const allTasks = tasks ?? [];
  const pendingTasks = allTasks.filter((task) => !task.completed);
  const overdueTasks = pendingTasks.filter((task) => task.due_date && new Date(task.due_date) < now);

  const nextEvent = (events ?? [])
    .filter((e) => new Date(e.starts_at) >= todayStart)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0];

  const upcomingDoctorAppts = (doctors ?? [])
    .filter((d) => d.next_appointment_at && new Date(d.next_appointment_at) >= todayStart)
    .sort(
      (a, b) =>
        new Date(a.next_appointment_at!).getTime() - new Date(b.next_appointment_at!).getTime(),
    );
  const nextDoctorAppt = upcomingDoctorAppts[0];

  const checkinToday = (checkins ?? []).find((c) => new Date(c.created_at) >= todayStart);

  const trackedMeds = (medications ?? []).filter(
    (m) => parseMedicationSchedule(m).periodType !== 'as_needed'
  );
  const pendingMeds = trackedMeds.filter(
    (m) => computeDoseStatusForDate(m, todayLogs[m.id], todayStart) !== 'taken'
  );
  const medDosesDone = trackedMeds.reduce(
    (sum, m) => sum + takenDoseSlotsForDate(m, todayLogs[m.id], todayStart),
    0
  );
  const medDosesTotal = trackedMeds.reduce((sum, m) => sum + scheduledDoseSlotsForDate(m, todayStart), 0);
  const medDosesRemaining = Math.max(0, medDosesTotal - medDosesDone);
  const medDosesComplete = medDosesTotal > 0 && medDosesDone >= medDosesTotal;
  const firstPendingMed = pendingMeds[0];

  const completedTasksCount = allTasks.filter((task) => task.completed).length;

  const moodAutoSummary: Record<CheckInMood, string> = {
    great: tx('home.dashboardSummary.checkIn.moodSummary.great'),
    good: tx('home.dashboardSummary.checkIn.moodSummary.good'),
    okay: tx('home.dashboardSummary.checkIn.moodSummary.okay'),
    concerning: tx('home.dashboardSummary.checkIn.moodSummary.concerning'),
    emergency: tx('home.dashboardSummary.checkIn.moodSummary.emergency'),
  };

  function handleQuickLog(medId: string) {
    if (!user) return;
    hapticImpact(ImpactFeedbackStyle.Light);
    const med = (medications ?? []).find((m) => m.id === medId);
    logDose.mutate({
      medication_id: medId,
      medication_name: med?.name ?? '',
      scheduled_at: new Date().toISOString(),
      status: 'taken',
      logged_by: user.id,
      quantity_remaining: med?.quantity_remaining ?? null,
      refill_threshold: med?.refill_threshold ?? null,
    });
  }

  function handleCompleteTask(task: Task) {
    hapticImpact(ImpactFeedbackStyle.Light);
    completeTask.mutate({ id: task.id, completed: true });
  }

  function handleQuickCheckIn(mood: CheckInMood) {
    if (!user) return;
    addCheckIn.mutate({ mood, summary: moodAutoSummary[mood], submitted_by: user.id });
  }

  const showProgress =
    trackedMeds.length > 0 || allTasks.length > 0 || todayEvents.length > 0;

  return (
    <View style={styles.container}>

      {/* ── Featured: Visit prep (glass pill expands in place) ── */}
      <VisitPrepGlassPromo onOpenVisitPrep={() => onNavigate('visitprep')} />

      {/* ── Today at a glance ─── */}
      {showProgress && (
        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>{tx('home.dashboardSummary.todayAtAGlance.title')}</Text>
          {trackedMeds.length > 0 && (
            <View style={styles.progressItem}>
              <View style={styles.progressLabelRow}>
                <View style={styles.progressLabelInner}>
                  <Icon name="medications" size={15} color={t.text} />
                  <Text style={styles.progressLabel}>{tx('home.nav.medications.label')}</Text>
                </View>
                <Text style={[styles.progressCount, medDosesComplete && styles.progressCountDone]}>
                  {medDosesDone}/{medDosesTotal}
                </Text>
              </View>
              <DayProgressBar
                done={medDosesDone} total={medDosesTotal}
                color={medDosesComplete ? t.success : t.accent}
              />
            </View>
          )}
          {allTasks.length > 0 && (
            <View style={[styles.progressItem, trackedMeds.length > 0 && { marginTop: 14 }]}>
              <View style={styles.progressLabelRow}>
                <View style={styles.progressLabelInner}>
                  <Icon name="tasks" size={15} color={t.text} />
                  <Text style={styles.progressLabel}>{tx('home.nav.tasks.label')}</Text>
                </View>
                <Text style={[styles.progressCount, completedTasksCount === allTasks.length && styles.progressCountDone]}>
                  {completedTasksCount}/{allTasks.length}
                </Text>
              </View>
              <DayProgressBar
                done={completedTasksCount} total={allTasks.length}
                color={completedTasksCount === allTasks.length ? t.success : t.accent}
              />
            </View>
          )}
          {todayEventsSorted.length > 0 && (
            <View
              style={[
                styles.progressItem,
                (trackedMeds.length > 0 || allTasks.length > 0) && { marginTop: 14 },
              ]}
            >
              <View style={styles.progressLabelRow}>
                <View style={styles.progressLabelInner}>
                  <Icon name="calendar" size={15} color={t.text} />
                  <Text style={styles.progressLabel}>{tx('home.nav.calendar.label')}</Text>
                </View>
              </View>
              <View style={styles.glanceEventsList}>
                {todayEventsSorted.map((ev, i) => (
                  <TouchableOpacity
                    key={ev.id}
                    style={[styles.glanceEventRow, i > 0 && styles.glanceEventRowSpacing]}
                    onPress={() => onNavigate('calendar')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.glanceEventTitle} numberOfLines={2}>
                      {ev.title}
                    </Text>
                    <Text style={styles.glanceEventMeta}>
                      {formatGlanceEventDateTime(ev.starts_at, localeTag)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* ── Check-in prompt ── */}
      {!checkinToday && (
        <View style={styles.checkinPrompt}>
          <Text style={styles.checkinQuestion}>
            {tx('home.dashboardSummary.checkIn.question', { name: family?.care_recipient_name ?? '' })}
          </Text>
          <View style={styles.moodBtnRow}>
            {MOODS.map(({ key: mood, mci, color }) => (
              <TouchableOpacity
                key={mood}
                style={styles.moodBtn}
                onPress={() => handleQuickCheckIn(mood)}
                disabled={addCheckIn.isPending}
                activeOpacity={0.65}
              >
                <MaterialCommunityIcons
                  name={mci as never}
                  size={26}
                  color={color}
                />
              </TouchableOpacity>
            ))}
          </View>
          {addCheckIn.isPending && (
            <ActivityIndicator size="small" color={t.accent} style={{ marginTop: 8 }} />
          )}
        </View>
      )}

      {/* ── Medications card ── */}
      <View style={[styles.card, styles.cardColumn]}>
        <View style={styles.cardTopRow}>
          <TouchableOpacity
            style={styles.cardTapArea}
            onPress={() => onNavigate('medications')}
            activeOpacity={0.7}
          >
            <View style={styles.cardIcon}><Icon name="medications" size={20} color={t.accent} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{tx('home.dashboardSummary.medicationsToday.title')}</Text>
              {trackedMeds.length === 0 ? (
                <Text style={styles.cardSub}>{tx('home.dashboardSummary.medicationsToday.noneTracked')}</Text>
              ) : medDosesComplete ? (
                <Text style={[styles.cardSub, styles.green]}>{tx('home.dashboardSummary.medicationsToday.allDosesLogged')}</Text>
              ) : (
                <>
                  <Text style={[styles.cardSub, styles.amber]}>
                    {tx('home.dashboardSummary.medicationsToday.dosesRemaining', { remaining: medDosesRemaining, total: medDosesTotal })}
                  </Text>
                  {pendingMeds.length === 1 && firstPendingMed ? (
                    <Text style={styles.cardMeta} numberOfLines={1}>{firstPendingMed.name}</Text>
                  ) : null}
                  {pendingMeds.length > 1 ? (
                    <Text style={styles.cardMeta}>{tx('home.dashboardSummary.medicationsToday.chooseBelow')}</Text>
                  ) : null}
                </>
              )}
            </View>
            {trackedMeds.length === 0 || medDosesComplete ? (
              <Icon name="chevron" size={18} color={t.borderLight} />
            ) : pendingMeds.length > 1 ? (
              <Icon name="chevron" size={18} color={t.borderLight} />
            ) : null}
          </TouchableOpacity>
          {pendingMeds.length === 1 && firstPendingMed ? (
            <TouchableOpacity
              style={styles.quickLogBtn}
              onPress={() => handleQuickLog(firstPendingMed.id)}
              disabled={logDose.isPending}
            >
              {logDose.isPending
                ? <ActivityIndicator size="small" color={t.surface} />
                : <Text style={styles.quickLogText}>{tx('home.dashboardSummary.common.log')}</Text>
              }
            </TouchableOpacity>
          ) : null}
        </View>
        {pendingMeds.length > 1 && (
          <>
            <TouchableOpacity
              style={styles.expandToggleRow}
              onPress={() => {
                hapticSelection();
                setMedsLogExpanded((e) => !e);
              }}
              activeOpacity={0.65}
            >
              <Text style={styles.expandToggleText}>
                {medsLogExpanded
                  ? tx('home.dashboardSummary.medicationsToday.hideMedications')
                  : tx('home.dashboardSummary.medicationsToday.showMedicationsToLog', { count: pendingMeds.length })}
              </Text>
              <DisclosureChevron expanded={medsLogExpanded} color={t.textTertiary} size={18} />
            </TouchableOpacity>
            <Collapsible expanded={medsLogExpanded}>
              {pendingMeds.map((med: Medication) => {
                const loggingThis =
                  logDose.isPending && logDose.variables?.medication_id === med.id;
                return (
                  <View key={med.id}>
                    <View style={styles.cardDividerFull} />
                    <View style={styles.homeSubRow}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.homeSubTitle} numberOfLines={2}>{med.name}</Text>
                        <Text style={styles.homeSubMeta} numberOfLines={1}>
                          {med.dosage} · {med.frequency}
                        </Text>
                        {med.times && med.times.length > 0 ? (
                          <Text style={styles.homeSubTimes} numberOfLines={1}>
                            {med.times.join(', ')}
                          </Text>
                        ) : null}
                      </View>
                      <TouchableOpacity
                        style={styles.quickLogBtn}
                        onPress={() => handleQuickLog(med.id)}
                        disabled={logDose.isPending}
                      >
                        {loggingThis
                          ? <ActivityIndicator size="small" color={t.surface} />
                          : <Text style={styles.quickLogText}>{tx('home.dashboardSummary.common.log')}</Text>
                        }
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </Collapsible>
          </>
        )}
      </View>

      {/* ── Tasks card ── */}
      <View style={[styles.card, styles.cardColumn]}>
        <TouchableOpacity style={styles.cardTapArea} onPress={() => onNavigate('tasks')} activeOpacity={0.7}>
          <View style={styles.cardIcon}><Icon name="tasks" size={20} color={t.accent} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{tx('home.nav.tasks.label')}</Text>
            {pendingTasks.length === 0 ? (
              <Text style={[styles.cardSub, styles.green]}>{tx('home.dashboardSummary.tasks.allCaughtUp')}</Text>
            ) : overdueTasks.length > 0 ? (
              <Text style={[styles.cardSub, styles.red]}>
                {tx('home.dashboardSummary.tasks.overdueAndOpen', { overdue: overdueTasks.length, open: pendingTasks.length })}
              </Text>
            ) : (
              <Text style={styles.cardSub}>{tx('home.dashboardSummary.tasks.open', { count: pendingTasks.length })}</Text>
            )}
            {pendingTasks.length > 1 ? (
              <Text style={styles.cardMeta}>{tx('home.dashboardSummary.tasks.chooseBelow')}</Text>
            ) : null}
          </View>
          <Icon name="chevron" size={18} color={t.borderLight} />
        </TouchableOpacity>
        {pendingTasks.length === 1 ? (
          <View>
            <View style={styles.cardDivider} />
            <View style={styles.taskRow}>
              <TouchableOpacity
                style={styles.taskCheckBtn}
                onPress={() => handleCompleteTask(pendingTasks[0])}
                disabled={completeTask.isPending}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <View style={[
                  styles.taskCheckbox,
                  completeTask.isPending && completeTask.variables?.id === pendingTasks[0].id && styles.taskCheckboxBusy,
                ]}>
                  {completeTask.isPending && completeTask.variables?.id === pendingTasks[0].id ? (
                    <ActivityIndicator size="small" color={t.accent} />
                  ) : null}
                </View>
              </TouchableOpacity>
              <Text style={styles.taskLabel} numberOfLines={1}>{pendingTasks[0].title}</Text>
              {pendingTasks[0].due_date && new Date(pendingTasks[0].due_date) < now && (
                <View style={styles.overduePill}><Text style={styles.overdueText}>{tx('home.dashboardSummary.tasks.overduePill')}</Text></View>
              )}
            </View>
          </View>
        ) : null}
        {pendingTasks.length > 1 ? (
          <>
            <TouchableOpacity
              style={styles.expandToggleRow}
              onPress={() => {
                hapticSelection();
                setTasksCheckExpanded((e) => !e);
              }}
              activeOpacity={0.65}
            >
              <Text style={styles.expandToggleText}>
                {tasksCheckExpanded
                  ? tx('home.dashboardSummary.tasks.hideTasks')
                  : tx('home.dashboardSummary.tasks.showTasksToComplete', { count: pendingTasks.length })}
              </Text>
              <DisclosureChevron expanded={tasksCheckExpanded} color={t.textTertiary} size={18} />
            </TouchableOpacity>
            <Collapsible expanded={tasksCheckExpanded}>
              {pendingTasks.map((task: Task) => {
                const completingThis =
                  completeTask.isPending && completeTask.variables?.id === task.id;
                const isOverdue = task.due_date && new Date(task.due_date) < now;
                return (
                  <View key={task.id}>
                    <View style={styles.cardDividerFull} />
                    <View style={styles.homeSubRow}>
                      <TouchableOpacity
                        style={styles.taskCheckBtn}
                        onPress={() => handleCompleteTask(task)}
                        disabled={completeTask.isPending}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <View style={[styles.taskCheckbox, completingThis && styles.taskCheckboxBusy]}>
                          {completingThis ? (
                            <ActivityIndicator size="small" color={t.accent} />
                          ) : null}
                        </View>
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.homeSubTitle} numberOfLines={2}>{task.title}</Text>
                        {task.due_date ? (
                          <View style={styles.homeTaskDueRow}>
                            {isOverdue ? <Icon name="warning" size={12} color={t.error} /> : null}
                            <Text style={[styles.homeSubMeta, isOverdue && styles.homeSubMetaOverdue]}>
                              {tx('home.dashboardSummary.tasks.dueOn', {
                                date: new Date(task.due_date).toLocaleDateString(localeTag, { month: 'short', day: 'numeric' }),
                              })}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      {isOverdue ? (
                        <View style={styles.overduePill}><Text style={styles.overdueText}>{tx('home.dashboardSummary.tasks.overduePill')}</Text></View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </Collapsible>
          </>
        ) : null}
      </View>

      {/* ── Next event ── */}
      <TouchableOpacity style={[styles.card, styles.cardRow]} onPress={() => onNavigate('calendar')} activeOpacity={0.7}>
        <View style={styles.cardIcon}><Icon name="calendar" size={20} color={t.accent} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{tx('home.dashboardSummary.nextEvent.title')}</Text>
          {nextEvent ? (
            <>
              <Text style={styles.cardSub} numberOfLines={1}>{nextEvent.title}</Text>
              <Text style={styles.cardMeta}>
                {new Date(nextEvent.starts_at).toLocaleDateString(localeTag, { weekday: 'short', month: 'short', day: 'numeric' })}
              </Text>
            </>
          ) : (
            <Text style={styles.cardSub}>{tx('home.dashboardSummary.nextEvent.none')}</Text>
          )}
        </View>
        <Icon name="chevron" size={18} color={t.borderLight} />
      </TouchableOpacity>

      {/* ── Doctors (care team reference) ── */}
      <TouchableOpacity style={[styles.card, styles.cardRow]} onPress={() => onNavigate('doctors')} activeOpacity={0.7}>
        <View style={styles.cardIcon}><Icon name="doctor" size={20} color={t.accent} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{tx('home.nav.doctors.label')}</Text>
          {(doctors?.length ?? 0) === 0 ? (
            <Text style={styles.cardSub}>{tx('home.dashboardSummary.doctors.emptyPrompt')}</Text>
          ) : nextDoctorAppt?.next_appointment_at ? (
            <>
              <Text style={styles.cardSub} numberOfLines={1}>
                {nextDoctorAppt.name}
              </Text>
              <Text style={styles.cardMeta}>
                {tx('home.dashboardSummary.doctors.nextVisitPrefix')}{' '}
                {(() => {
                  const d = new Date(nextDoctorAppt.next_appointment_at!);
                  const datePart = d.toLocaleDateString(localeTag, { weekday: 'short', month: 'short', day: 'numeric' });
                  // Match DoctorsScreen / Calendar: local 00:00 = date-only visit (no time).
                  if (d.getHours() === 0 && d.getMinutes() === 0) return datePart;
                  const timePart = d.toLocaleTimeString(localeTag, { hour: 'numeric', minute: '2-digit' });
                  return `${datePart} · ${timePart}`;
                })()}
              </Text>
            </>
          ) : (
            <Text style={styles.cardSub}>
              {tx('home.dashboardSummary.doctors.onFileTapToAddNextVisit', { count: doctors?.length ?? 0 })}
            </Text>
          )}
        </View>
        <Icon name="chevron" size={18} color={t.borderLight} />
      </TouchableOpacity>

      {/* ── Today's check-in (only when logged today) ── */}
      {checkinToday && (
        <TouchableOpacity style={[styles.card, styles.cardRow]} onPress={() => onNavigate('checkins')} activeOpacity={0.7}>
          <View style={styles.cardIcon}><Icon name="checkin" size={20} color={t.accent} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{tx('home.dashboardSummary.todaysCheckIn.title')}</Text>
            <View style={styles.moodStatusRow}>
              <MaterialCommunityIcons
                name={moodMeta(checkinToday.mood).mci as never}
                size={18}
                color={moodMeta(checkinToday.mood).color}
              />
              <Text style={[styles.moodStatusLabel, { color: moodMeta(checkinToday.mood).color }]}>
                {checkinToday.mood.charAt(0).toUpperCase() + checkinToday.mood.slice(1)}
              </Text>
              <Text style={styles.cardMeta}> · {timeAgo(checkinToday.created_at, tx)}</Text>
            </View>
            <Text style={styles.cardSub} numberOfLines={1}>{checkinToday.summary}</Text>
          </View>
          <Icon name="chevron" size={18} color={t.borderLight} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { gap: space[3] },

    // Progress card
    progressCard: {
      backgroundColor: t.surface, borderRadius: 14, padding: space[4],
      shadowColor: t.shadow, shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    },
    progressTitle: { ...typography.overline, color: t.textTertiary, marginBottom: space[4], textTransform: 'uppercase' },
    progressItem: {},
    glanceEventsList: { marginTop: space[1] },
    glanceEventRow: {},
    glanceEventRowSpacing: { marginTop: space[3], paddingTop: space[3], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
    glanceEventTitle: { ...typography.callout, fontWeight: '600', color: t.text },
    glanceEventMeta: { ...typography.footnote, color: t.textTertiary, marginTop: 3 },
    progressLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[2] },
    progressLabelInner: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
    progressLabel: { ...typography.caption, fontWeight: '600', color: t.text },
    progressCount: { ...typography.caption, fontWeight: '600', color: t.textSecondary },
    progressCountDone: { color: t.success },

    // Check-in prompt
    checkinPrompt: {
      backgroundColor: t.surface, borderRadius: 14, padding: space[4],
      shadowColor: t.shadow, shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    },
    checkinQuestion: { ...typography.bodyBold, color: t.text, marginBottom: space[4] },
    moodBtnRow: { flexDirection: 'row', gap: space[2] },
    moodBtn: {
      flex: 1, paddingVertical: space[3], borderRadius: 12,
      backgroundColor: t.surfaceAlt, alignItems: 'center',
    },

    // Cards
    card: {
      backgroundColor: t.surface, borderRadius: 14, overflow: 'hidden',
      shadowColor: t.shadow, shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
      flexDirection: 'row', alignItems: 'center',
    },
    cardColumn: {
      flexDirection: 'column',
      alignItems: 'stretch',
    },
    cardTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    cardRow: { padding: space[4], gap: space[3] },
    cardTapArea: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: space[4], gap: space[3] },
    cardDividerFull: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: t.border,
    },
    expandToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: space[3],
      paddingHorizontal: space[4],
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.border,
    },
    expandToggleText: {
      flex: 1,
      paddingRight: space[2],
      ...typography.caption,
      fontWeight: '600',
      color: t.textSecondary,
    },
    homeSubRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
      paddingVertical: space[3],
      paddingLeft: space[4],
      paddingRight: space[3],
    },
    homeSubTitle: { ...typography.bodyBold, color: t.text },
    homeSubMeta: { ...typography.footnote, color: t.textTertiary, marginTop: 2 },
    homeSubMetaOverdue: { color: t.error, fontWeight: '600' },
    homeSubTimes: { ...typography.footnote, color: t.textSecondary, marginTop: 2 },
    homeTaskDueRow: { flexDirection: 'row', alignItems: 'center', gap: space[1], marginTop: space[1] },
    cardIcon: {
      width: space[4] + space[5], height: space[4] + space[5], borderRadius: 10, backgroundColor: t.accentLight,
      alignItems: 'center', justifyContent: 'center',
    },
    cardTitle: { ...typography.overline, color: t.textSecondary, letterSpacing: 0.4, textTransform: 'uppercase' },
    cardSub: { ...typography.callout, color: t.text, marginTop: 2 },
    cardMeta: { ...typography.footnote, color: t.textTertiary },

    // Quick log button
    quickLogBtn: {
      backgroundColor: t.accent, borderRadius: 10,
      paddingHorizontal: space[4], paddingVertical: space[2], marginRight: space[3],
    },
    quickLogText: { ...typography.caption, fontWeight: '700', color: t.surface },

    // Task inline rows (checkbox matches TaskBoardScreen)
    cardDivider: { height: StyleSheet.hairlineWidth, backgroundColor: t.border, marginLeft: space[4] + space[5] + space[4] },
    taskRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: space[4], paddingRight: space[4], paddingVertical: space[3], gap: space[3] },
    taskCheckBtn: { padding: 2 },
    taskCheckbox: {
      width: space[5],
      height: space[5],
      borderRadius: space[3],
      borderWidth: 2,
      borderColor: t.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    taskCheckboxBusy: {
      borderColor: t.accent,
    },
    taskLabel: { flex: 1, ...typography.callout, color: t.text },
    // layout-exception: compact warning pill inside row
    overduePill: { backgroundColor: t.error + '20', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    overdueText: { ...typography.overline, fontWeight: '600', color: t.error },

    // Mood status (today's check-in card)
    moodStatusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: space[1] },
    moodStatusLabel: { ...typography.caption, fontWeight: '600' },

    // Status colors
    green: { color: t.success },
    amber: { color: t.warning },
    red: { color: t.error },
  });
}
