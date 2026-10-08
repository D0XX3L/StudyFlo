/**
 * Study Planner - Main Interactive Controller
 * Handles local storage persistence, task CRUD, Pomodoro timer, and UI modals.
 */

// --- Default Seed Data ---
const DEFAULT_TASKS = [
  {
    id: 1,
    title: 'Review Data Structures Lecture 6',
    subject: 'CS',
    due: '09:00 AM',
    completed: true,
  },
  {
    id: 2,
    title: 'Solve Calculus II Problem Set #4',
    subject: 'Math',
    due: 'Due 4:00 PM',
    completed: false,
  },
  {
    id: 3,
    title: 'Read Physics Chapter 3: Thermodynamics',
    subject: 'Physics',
    due: 'Due 7:30 PM',
    completed: false,
  },
  {
    id: 4,
    title: 'Outline Research Paper for Literature',
    subject: 'Literature',
    due: 'Evening',
    completed: false,
  },
];

// --- App State ---
let tasks = [];
let timerDuration = 1500; // Default: 25 minutes
let timerLeft = 1500;
let timerInterval = null;

// --- DOM Elements ---
const taskListEl = document.getElementById('taskList');
const pendingCountEl = document.getElementById('pendingCount');
const completionRateEl = document.getElementById('completionRate');
const currentDateEl = document.getElementById('currentDate');

const taskModalEl = document.getElementById('taskModal');
const openModalBtn = document.getElementById('openTaskModal');
const closeModalBtn = document.getElementById('closeTaskModal');
const cancelModalBtn = document.getElementById('cancelModal');
const newTaskFormEl = document.getElementById('newTaskForm');

const timerDisplayEl = document.getElementById('timeDisplay');
const toggleTimerBtn = document.getElementById('toggleTimer');
const resetTimerBtn = document.getElementById('resetTimer');
const timerTabs = document.querySelectorAll('.timer-tab');
const scrollTimerBtn = document.getElementById('scrollTimer');

// ==========================================
// 1. Storage Helpers
// ==========================================
function loadTasks() {
  const saved = localStorage.getItem('study_planner_tasks');
  if (saved) {
    try {
      tasks = JSON.parse(saved);
    } catch {
      tasks = [...DEFAULT_TASKS];
    }
  } else {
    tasks = [...DEFAULT_TASKS];
    saveTasks();
  }
}

function saveTasks() {
  localStorage.setItem('study_planner_tasks', JSON.stringify(tasks));
}

// ==========================================
// 2. Render Functions
// ==========================================
function renderTasks() {
  taskListEl.innerHTML = '';

  if (tasks.length === 0) {
    taskListEl.innerHTML = `
      <li style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.9rem;">
        No tasks for today! Click "New Task" to add one. 🎉
      </li>
    `;
    updateSummaryStats();
    return;
  }

  tasks.forEach((task) => {
    const li = document.createElement('li');
    li.className = `task-item ${task.completed ? 'completed' : ''}`;
    li.dataset.id = task.id;

    const tagClass = 'tag-' + task.subject.toLowerCase();

    li.innerHTML = `
      <label class="custom-checkbox">
        <input type="checkbox" ${task.completed ? 'checked' : ''}>
        <span class="checkmark"></span>
      </label>
      <div class="task-info">
        <span class="task-title">${escapeHtml(task.title)}</span>
        <span class="task-meta">${escapeHtml(task.subject)} • ${escapeHtml(task.due)}</span>
      </div>
      <span class="tag ${tagClass}">${escapeHtml(task.subject)}</span>
      <button class="delete-btn" title="Delete task" aria-label="Delete task">
        <i data-lucide="trash-2"></i>
      </button>
    `;

    taskListEl.appendChild(li);
  });

  if (window.lucide) {
    lucide.createIcons();
  }

  updateSummaryStats();
}

function updateSummaryStats() {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  const pending = total - completed;

  if (pendingCountEl) pendingCountEl.innerText = pending;
  if (completionRateEl) completionRateEl.innerText = `${completed}/${total} Done`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ==========================================
// 3. Task Event Listeners
// ==========================================
taskListEl.addEventListener('click', (e) => {
  const itemEl = e.target.closest('.task-item');
  if (!itemEl) return;
  const id = Number(itemEl.dataset.id);

  // Toggle checkbox
  if (e.target.matches('input[type="checkbox"]')) {
    const task = tasks.find((t) => t.id === id);
    if (task) {
      task.completed = e.target.checked;
      saveTasks();
      itemEl.classList.toggle('completed', task.completed);
      updateSummaryStats();
    }
    return;
  }

  // Delete button
  if (e.target.closest('.delete-btn')) {
    tasks = tasks.filter((t) => t.id !== id);
    saveTasks();
    renderTasks();
  }
});

// Modal Logic
function setModalOpen(isOpen) {
  taskModalEl.classList.toggle('active', isOpen);
  if (isOpen) {
    document.getElementById('taskTitle').focus();
  }
}

openModalBtn?.addEventListener('click', () => setModalOpen(true));
closeModalBtn?.addEventListener('click', () => setModalOpen(false));
cancelModalBtn?.addEventListener('click', () => setModalOpen(false));

// Close modal on outside backdrop click or Escape key
taskModalEl?.addEventListener('click', (e) => {
  if (e.target === taskModalEl) setModalOpen(false);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && taskModalEl.classList.contains('active')) {
    setModalOpen(false);
  }
});

// Add Task Form Submission
newTaskFormEl?.addEventListener('submit', (e) => {
  e.preventDefault();

  const titleInput = document.getElementById('taskTitle');
  const subjectSelect = document.getElementById('taskSubject');
  const dueInput = document.getElementById('taskDue');

  const newTask = {
    id: Date.now(),
    title: titleInput.value.trim(),
    subject: subjectSelect.value,
    due: dueInput.value.trim() || 'Today',
    completed: false,
  };

  tasks.unshift(newTask);
  saveTasks();
  renderTasks();

  newTaskFormEl.reset();
  setModalOpen(false);
});

// ==========================================
// 4. Focus / Pomodoro Timer
// ==========================================
function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateTimerDisplay() {
  if (timerDisplayEl) {
    timerDisplayEl.textContent = formatTime(timerLeft);
  }
}

function playCompletionChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

    osc.start();
    osc.stop(ctx.currentTime + 0.8);
  } catch (err) {
    console.warn('AudioContext not permitted or supported yet:', err);
  }
}

timerTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    timerTabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');

    clearInterval(timerInterval);
    timerInterval = null;

    toggleTimerBtn.innerHTML = '<i data-lucide="play"></i> Start';
    timerDuration = parseInt(tab.dataset.time, 10);
    timerLeft = timerDuration;
    updateTimerDisplay();

    if (window.lucide) lucide.createIcons();
  });
});

toggleTimerBtn?.addEventListener('click', () => {
  if (timerInterval) {
    // Pause state
    clearInterval(timerInterval);
    timerInterval = null;
    toggleTimerBtn.innerHTML = '<i data-lucide="play"></i> Resume';
  } else {
    // Start/Resume state
    timerInterval = setInterval(() => {
      if (timerLeft > 0) {
        timerLeft--;
        updateTimerDisplay();
      } else {
        clearInterval(timerInterval);
        timerInterval = null;
        toggleTimerBtn.innerHTML = '<i data-lucide="play"></i> Start';
        playCompletionChime();
        alert('🎉 Focus session completed! Time to take a short breather.');
      }
    }, 1000);
    toggleTimerBtn.innerHTML = '<i data-lucide="pause"></i> Pause';
  }

  if (window.lucide) lucide.createIcons();
});

resetTimerBtn?.addEventListener('click', () => {
  clearInterval(timerInterval);
  timerInterval = null;
  timerLeft = timerDuration;
  toggleTimerBtn.innerHTML = '<i data-lucide="play"></i> Start';
  updateTimerDisplay();

  if (window.lucide) lucide.createIcons();
});

scrollTimerBtn?.addEventListener('click', () => {
  document.getElementById('pomodoroSection')?.scrollIntoView({ behavior: 'smooth' });
});

// ==========================================
// 5. Date Initialization
// ==========================================
function initDate() {
  if (!currentDateEl) return;
  const options = { weekday: 'long', month: 'long', day: 'numeric' };
  currentDateEl.textContent = new Date().toLocaleDateString('en-US', options);
}

// ==========================================
// Initialization on Load
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initDate();
  loadTasks();
  renderTasks();
  updateTimerDisplay();

  if (window.lucide) {
    lucide.createIcons();
  }
});