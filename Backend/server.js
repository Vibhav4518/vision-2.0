const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Helper function to get dates between two dates inclusive
function getDatesBetween(startDate, endDate) {
  const dates = [];
  let current = new Date(startDate);
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

app.post('/generate-timetable', (req, res) => {
  try {
    const { subjects, availableHours } = req.body;

    if (!Array.isArray(subjects) || subjects.length === 0 || !availableHours) {
      return res.status(400).json({ error: 'Invalid input data' });
    }

    const today = new Date();
    today.setHours(0,0,0,0);

    // Parse and clean subjects, filter out invalid
    const parsedSubjects = subjects.map(s => ({
      name: s.name.trim(),
      examDate: new Date(s.examDate)
    })).filter(s => s.name && s.examDate >= today);

    if (parsedSubjects.length === 0) {
      return res.status(400).json({ error: 'No valid subjects with future exam dates' });
    }

    // Find the latest exam date overall
    const lastExamDate = parsedSubjects.reduce((max, s) => s.examDate > max ? s.examDate : max, today);

    // Calculate total days for each subject (from today to exam date inclusive)
    // and total weighted days for proportional allocation
    const subjectsWithDays = parsedSubjects.map(s => {
      const days = Math.ceil((s.examDate - today) / (1000 * 60 * 60 * 24)) + 1;
      return { ...s, days };
    });

    const totalInverseDays = subjectsWithDays.reduce((sum, s) => sum + (1 / s.days), 0);

    // Generate timetable by days from today to lastExamDate
    const totalDays = getDatesBetween(today, lastExamDate);

    // For each date, calculate study hours per subject proportionally
    // Subjects closer to exam get more weight: weight = (1/days)
    // Total hours per day = availableHours

    const timetable = totalDays.map(date => {
      const schedules = [];

      subjectsWithDays.forEach(subject => {
        // Study only on days before or equal exam date
        if (date <= subject.examDate) {
          // Allocate proportional hours based on weights
          // hours = totalHours * weight / totalWeight
          // Here weight = 1/days
          const hours = availableHours * ((1 / subject.days) / totalInverseDays);

          // Round hours to 2 decimals
          schedules.push({
            subject: subject.name,
            hours: Math.max(0, hours)
          });
        }
      });

      return {
        date: date.toISOString().substring(0,10),
        schedules
      };
    }).filter(day => day.schedules.length > 0);

    res.json(timetable);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Smart Study Planner backend running on http://localhost:${PORT}`);
});

