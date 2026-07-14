import { useCallback, useMemo, useState } from 'react';
import Heatmap from './Heatmap';
import MonthDetail from './MonthDetail';
import DayDetail from './DayDetail';

// Owns the hover/click selection state that used to live in Profile.
// Nothing outside this component reads selectedDay/selectedMonth, so
// keeping the state here means hovering a day only re-renders this
// subtree - Profile's header, links, and controls never see the update.
//
// Profile mounts this with key={`${platform}-${year}`}, so switching
// platform or year remounts it fresh (selection reset for free) instead
// of needing explicit "clear selection" calls in Profile's handlers.
export default function ActivityBoard({ values, color, startDate, endDate, year, platform }) {
  const [selectedMonth, setSelectedMonth] = useState(null); // 0-11 or null
  const [selectedDay, setSelectedDay] = useState(null);

  const monthDays = useMemo(
    () => (selectedMonth == null ? null : values.filter((d) => Number(d.date.slice(5, 7)) - 1 === selectedMonth)),
    [values, selectedMonth]
  );

  // Stable identity across every re-render (including the ones triggered
  // by hover) - this is what lets Heatmap's memo actually skip work.
  const handleMonthClick = useCallback((month) => {
    setSelectedMonth((prev) => (prev === month ? null : month));
    setSelectedDay(null);
  }, []);

  const closeMonth = useCallback(() => setSelectedMonth(null), []);
  const closeDay = useCallback(() => setSelectedDay(null), []);

  return (
    <>
      <Heatmap
        values={values}
        color={color}
        onDayClick={setSelectedDay}
        onMonthClick={handleMonthClick}
        startDate={startDate}
        endDate={endDate}
        highlightMonth={selectedMonth}
        platform={platform}
      />

      <div className="details-grid">
        {monthDays && <MonthDetail days={monthDays} month={selectedMonth} year={year} onClose={closeMonth} />}
        {selectedDay && <DayDetail day={selectedDay} platform={platform} onClose={closeDay} />}
      </div>
    </>
  );
}
