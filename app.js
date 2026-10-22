/**
 * LabMaster 2026-2027 - Application Logic (V3)
 * Nghiệp vụ theo yêu cầu chặt chẽ:
 * 1. Phân quyền chuẩn: Giáo viên KHÔNG THỂ hạ quyền Admin, chỉ quản lý tiết của mình.
 * 2. Ai đăng ký trước thì giữ lịch trước, ai đến sau không được đăng ký đè (phải báo Admin hoặc nhờ người đăng ký hủy).
 * 3. Tự động khóa sổ khi hết tuần, Admin có thể mở sổ để giáo viên sửa hoặc Admin trực tiếp xóa.
 * 4. Giáo viên vẫn được ký nhận/bàn giao khi dạy dù sổ đã khóa.
 * 5. Giáo viên có thể nạp file báo giảng (Excel Mẫu báo giảng.xlsx) để chọn tiết đăng ký vào phòng máy.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'LABMASTER_DATA_V3';
  const CURRENT_USER_KEY = 'LABMASTER_CURRENT_USER_V3';

  let appState = {
    schoolYear: '2026 - 2027',
    yearStartDate: '2026-09-07',
    yearEndDate: '2027-05-31',
    currentWeekNumber: 7,
    selectedWeekNumber: 7,
    selectedRoomId: '',
    activeView: 'today',        // Mặc định mở trang tra cứu lịch hôm nay
    adminActiveSubTab: 'rooms',
    todayDayOffset: 0,
    rooms: [],
    classes: [],
    subjects: [],
    users: [],
    bookings: [],
    issues: [],
    weekCustomNames: {},
    lockedWeeks: {},            // { [weekNum]: boolean } (true = locked, false = unlocked)
    currentUser: null,
    generatedWeeks: [],
    tempBaoGiang: null          // Lưu trữ dữ liệu file báo giảng đang xem trước
  };

  const DAY_NAMES = {
    2: 'Thứ 2',
    3: 'Thứ 3',
    4: 'Thứ 4',
    5: 'Thứ 5',
    6: 'Thứ 6',
    7: 'Thứ 7'
  };

  const PERIOD_TIMES = {
    sang: {
      1: '07:15 - 08:00',
      2: '08:05 - 08:50',
      3: '09:05 - 09:50',
      4: '09:55 - 10:40',
      5: '10:45 - 11:30'
    },
    chieu: {
      1: '13:15 - 14:00',
      2: '14:05 - 14:50',
      3: '15:05 - 15:50',
      4: '15:55 - 16:40',
      5: '16:45 - 17:30'
    }
  };

  // ================= INITIALIZATION =================
  window.addEventListener('DOMContentLoaded', () => {
    initData();
    initClock();
    renderAll();
    setupGlobalClickListeners();
  });

  function initData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    const initial = window.LAB_INITIAL_DATA || {};

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        appState.schoolYear = parsed.schoolYear || initial.schoolYear || '2026 - 2027';
        appState.yearStartDate = parsed.yearStartDate || initial.yearStartDate || '2026-09-07';
        appState.yearEndDate = parsed.yearEndDate || initial.yearEndDate || '2027-05-31';
        appState.currentWeekNumber = parsed.currentWeekNumber || 7;
        appState.selectedWeekNumber = parsed.selectedWeekNumber || 7;
        appState.rooms = parsed.rooms && parsed.rooms.length ? parsed.rooms : (initial.rooms || []);
        appState.classes = parsed.classes && parsed.classes.length ? parsed.classes : (initial.classes || []);
        appState.subjects = parsed.subjects || initial.subjects || [];
        appState.users = parsed.users && parsed.users.length ? parsed.users : (initial.users || []);
        appState.bookings = parsed.bookings || [];
        appState.issues = parsed.issues || [];
        appState.weekCustomNames = parsed.weekCustomNames || initial.weekCustomNames || {};
        appState.lockedWeeks = parsed.lockedWeeks || {};
        appState.selectedRoomId = parsed.selectedRoomId || (appState.rooms[0]?.id || '');
      } catch (e) {
        console.error('Error parsing localStorage', e);
        loadDefaultInitial(initial);
      }
    } else {
      loadDefaultInitial(initial);
    }

    generateSchoolWeeks();

    // Init Current User
    const savedUser = localStorage.getItem(CURRENT_USER_KEY);
    if (savedUser) {
      try {
        appState.currentUser = JSON.parse(savedUser);
      } catch (e) {
        appState.currentUser = appState.users[0];
      }
    } else {
      appState.currentUser = appState.users[0] || {
        email: 'admin@gmail.com',
        name: 'Quản Trị Viên',
        role: 'admin'
      };
    }

    if (!appState.selectedRoomId && appState.rooms.length > 0) {
      appState.selectedRoomId = appState.rooms[0].id;
    }
  }

  function loadDefaultInitial(initial) {
    appState.schoolYear = initial.schoolYear || '2026 - 2027';
    appState.yearStartDate = initial.yearStartDate || '2026-09-07';
    appState.yearEndDate = initial.yearEndDate || '2027-05-31';
    appState.currentWeekNumber = initial.currentWeekNumber || 7;
    appState.selectedWeekNumber = 7;
    appState.rooms = initial.rooms || [];
    appState.classes = initial.classes || [];
    appState.subjects = initial.subjects || [];
    appState.users = initial.users || [
      {
        email: 'admin@gmail.com',
        name: 'Quản Trị Viên Phòng Máy',
        phone: '0988888888',
        role: 'admin',
        department: 'Ban Quản Trị'
      }
    ];
    appState.bookings = []; // Sạch hoàn toàn
    appState.issues = [];
    appState.weekCustomNames = initial.weekCustomNames || {};
    appState.lockedWeeks = {};
    appState.selectedRoomId = appState.rooms[0]?.id || '';
    saveState();
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        schoolYear: appState.schoolYear,
        yearStartDate: appState.yearStartDate,
        yearEndDate: appState.yearEndDate,
        currentWeekNumber: appState.currentWeekNumber,
        selectedWeekNumber: appState.selectedWeekNumber,
        selectedRoomId: appState.selectedRoomId,
        rooms: appState.rooms,
        classes: appState.classes,
        subjects: appState.subjects,
        users: appState.users,
        bookings: appState.bookings,
        issues: appState.issues,
        weekCustomNames: appState.weekCustomNames,
        lockedWeeks: appState.lockedWeeks
      }));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }

  // ================= SCHOOL WEEKS GENERATOR =================
  function generateSchoolWeeks() {
    appState.generatedWeeks = [];
    const [startYear, startMonth, startDay] = appState.yearStartDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = appState.yearEndDate.split('-').map(Number);

    let curMonday = new Date(startYear, startMonth - 1, startDay);
    const endDate = new Date(endYear, endMonth - 1, endDay);

    let wNum = 1;
    while (curMonday <= endDate) {
      const curSunday = new Date(curMonday);
      curSunday.setDate(curMonday.getDate() + 6);

      const mStr = String(curMonday.getMonth() + 1).padStart(2, '0');
      const yStr = curMonday.getFullYear();
      const monthGroup = `${mStr}/${yStr}`;

      const sDay = String(curMonday.getDate()).padStart(2, '0');
      const sMon = String(curMonday.getMonth() + 1).padStart(2, '0');
      const sYear = curMonday.getFullYear();

      const eDay = String(curSunday.getDate()).padStart(2, '0');
      const eMon = String(curSunday.getMonth() + 1).padStart(2, '0');
      const eYear = curSunday.getFullYear();

      const dateRangeStr = `${sDay}/${sMon}/${sYear} - ${eDay}/${eMon}/${eYear}`;
      const customTitle = appState.weekCustomNames[wNum];
      const baseLabel = `Tuần (${dateRangeStr})`;
      const label = customTitle ? `${customTitle} (${sDay}/${sMon} - ${eDay}/${eMon})` : baseLabel;
      const fullLabel = customTitle ? `${customTitle} (${dateRangeStr})` : `Tuần ${wNum} (${dateRangeStr})`;

      const dayDates = {};
      for (let d = 2; d <= 7; d++) {
        const dObj = new Date(curMonday);
        dObj.setDate(curMonday.getDate() + (d - 2));
        const dd = String(dObj.getDate()).padStart(2, '0');
        const mm = String(dObj.getMonth() + 1).padStart(2, '0');
        dayDates[d] = {
          dateStr: `${dd}/${mm}/${dObj.getFullYear()}`,
          shortStr: `${dd}/${mm}`,
          fullDate: dObj
        };
      }

      appState.generatedWeeks.push({
        weekNumber: wNum,
        monthGroup: monthGroup,
        startDate: curMonday.toISOString().slice(0, 10),
        endDate: curSunday.toISOString().slice(0, 10),
        dateRangeStr: dateRangeStr,
        customTitle: customTitle || '',
        label: label,
        baseLabel: baseLabel,
        fullLabel: fullLabel,
        isCurrent: wNum === appState.currentWeekNumber,
        dayDates: dayDates
      });

      curMonday.setDate(curMonday.getDate() + 7);
      wNum++;
    }
  }

  // ================= AUTO-LOCK & WEEK STATUS LOGIC =================
  // "hết tuần sẽ tự động khóa sổ hoặc admin có thể mở sổ để giáo viên sửa"
  function isWeekLocked(weekNum) {
    // 1. Nếu Admin đã chỉ định rõ khóa hoặc mở cho tuần này:
    if (appState.lockedWeeks[weekNum] !== undefined) {
      return !!appState.lockedWeeks[weekNum];
    }

    // 2. Tự động khóa nếu tuần đó đã kết thúc trong quá khứ (Tuần < Tuần hiện tại)
    const weekObj = appState.generatedWeeks.find(w => w.weekNumber === weekNum);
    if (weekObj) {
      // Giả lập theo mốc thời gian năm học 2026-2027:
      // Nếu weekNum < appState.currentWeekNumber thì tuần đó đã trôi qua -> Tự động khóa!
      if (weekNum < appState.currentWeekNumber) {
        return true;
      }
    }

    return false;
  }

  // ================= LIVE CLOCK =================
  function initClock() {
    function update() {
      const clockEl = document.getElementById('headerLiveClock');
      if (clockEl) {
        const now = new Date();
        const d = String(now.getDate()).padStart(2, '0');
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const y = now.getFullYear();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        clockEl.textContent = `${d}/${m}/${y} - ${hh}:${mm}`;
      }
    }
    update();
    setInterval(update, 30000);
  }

  // ================= MASTER RENDER =================
  function renderAll() {
    renderUserBar();
    renderRoomTabs();
    renderWeekDropdown();
    renderActiveView();
  }

  function renderUserBar() {
    const u = appState.currentUser || {};
    const avatarEl = document.getElementById('userAvatarImg');
    const nameEl = document.getElementById('userNameTxt');
    const emailEl = document.getElementById('userEmailTxt');
    const badgeEl = document.getElementById('userRoleBadge');

    const menuName = document.getElementById('menuUserFullName');
    const menuEmail = document.getElementById('menuUserEmail');
    const menuRolePill = document.getElementById('menuUserRolePill');

    if (avatarEl) avatarEl.src = u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80';
    if (nameEl) nameEl.textContent = u.name || 'Người dùng';
    if (emailEl) emailEl.textContent = u.email || 'user@gmail.com';

    const isAdmin = u.role === 'admin';
    if (badgeEl) {
      badgeEl.textContent = isAdmin ? 'Admin' : 'GV';
      badgeEl.className = isAdmin
        ? 'text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 border border-purple-200'
        : 'text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 border border-blue-200';
    }

    if (menuName) menuName.textContent = u.name || '';
    if (menuEmail) menuEmail.textContent = u.email || '';
    if (menuRolePill) {
      menuRolePill.className = isAdmin
        ? 'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200'
        : 'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200';
      menuRolePill.innerHTML = isAdmin
        ? '<i class="fa-solid fa-shield-halved"></i> Quản trị viên hệ thống'
        : '<i class="fa-solid fa-user-check"></i> Giáo viên bộ môn';
    }

    // BẢO VỆ PHÂN QUYỀN: Giáo viên KHÔNG THỂ nhìn thấy tab Quản Trị
    const adminTab = document.getElementById('tabBtn-admin');
    if (adminTab) {
      if (isAdmin) {
        adminTab.classList.remove('hidden');
      } else {
        adminTab.classList.add('hidden');
        if (appState.activeView === 'admin') {
          switchView('today');
        }
      }
    }
  }

  function renderRoomTabs() {
    const container = document.getElementById('roomTabsContainer');
    if (!container) return;

    if (appState.rooms.length === 0) {
      container.innerHTML = `
        <span class="text-xs text-amber-700 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200">
          Chưa khai báo phòng. Quản trị viên vui lòng vào mục Quản trị để khai báo phòng thực hành của trường.
        </span>
      `;
      return;
    }

    container.innerHTML = appState.rooms.map(room => {
      const isSelected = room.id === appState.selectedRoomId;
      const activeClass = isSelected
        ? 'bg-slate-900 text-white shadow-md'
        : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200';

      return `
        <button onclick="selectRoom('${room.id}')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${activeClass}">
          <i class="fa-solid fa-chalkboard text-[11px] ${isSelected ? 'text-brand-400' : 'text-slate-400'}"></i>
          <span>${room.name}</span>
          <span class="text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}">
            ${room.totalComputers || 0}m
          </span>
        </button>
      `;
    }).join('');
  }

  // ================= VIEW SWITCHER =================
  window.switchView = function (viewName) {
    // Nếu không phải admin mà cố vào admin thì chặn lại
    if (viewName === 'admin' && appState.currentUser?.role !== 'admin') {
      alert('Bạn không có quyền truy cập khu vực Quản trị hệ thống!');
      return;
    }

    appState.activeView = viewName;

    ['today', 'timetable', 'standardTable', 'admin'].forEach(tab => {
      const btn = document.getElementById(`tabBtn-${tab}`);
      const viewEl = document.getElementById(`view-${tab}`);

      if (btn) {
        if (tab === viewName) {
          btn.className = tab === 'today'
            ? 'px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
            : (tab === 'admin'
                ? 'px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition bg-purple-600 text-white shadow-md ml-auto'
                : 'px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition bg-slate-900 text-white shadow-sm');
        } else {
          btn.className = tab === 'admin'
            ? 'px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition text-purple-700 bg-purple-50/80 hover:bg-purple-100 border border-purple-200/80 ml-auto'
            : 'px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition text-slate-600 hover:text-slate-900 hover:bg-slate-100';
        }
      }

      if (viewEl) {
        if (tab === viewName) viewEl.classList.remove('hidden');
        else viewEl.classList.add('hidden');
      }
    });

    renderActiveView();
  };

  function renderActiveView() {
    switch (appState.activeView) {
      case 'today':
        renderTodayView();
        break;
      case 'timetable':
        renderTimetableGrid();
        break;
      case 'standardTable':
        renderStandardTable();
        break;
      case 'admin':
        renderAdminPanel();
        break;
    }
  }

  // =========================================================================
  // VIEW 1: LỊCH HÔM NAY (CHO GIÁO VIÊN VÀ HỌC SINH TRA CỨU)
  // =========================================================================
  window.changeTodayOffset = function (delta) {
    appState.todayDayOffset += delta;
    renderTodayView();
  };

  window.resetTodayOffset = function () {
    appState.todayDayOffset = 0;
    renderTodayView();
  };

  function renderTodayView() {
    const classFilter = document.getElementById('todayFilterClass');
    if (classFilter && classFilter.options.length <= 1) {
      classFilter.innerHTML = '<option value="all">Tất cả các lớp học sinh</option>' +
        appState.classes.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    const roomFilter = document.getElementById('todayFilterRoom');
    if (roomFilter && roomFilter.options.length <= 1) {
      roomFilter.innerHTML = '<option value="all">Tất cả phòng thực hành</option>' +
        appState.rooms.map(r => `<option value="${r.name}">${r.name}</option>`).join('');
    }

    const baseDate = new Date(2026, 9, 21); // Thứ 4, 21/10/2026
    const targetDate = new Date(baseDate);
    targetDate.setDate(baseDate.getDate() + appState.todayDayOffset);

    const dNum = targetDate.getDay();
    const dayOfWeek = dNum === 0 ? 8 : (dNum + 1);

    const dd = String(targetDate.getDate()).padStart(2, '0');
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const yyyy = targetDate.getFullYear();
    const dateFormatted = `${dd}/${mm}/${yyyy}`;
    const dayLabel = dayOfWeek === 8 ? 'Chủ nhật' : DAY_NAMES[dayOfWeek];

    const titleEl = document.getElementById('todayHeaderDateTitle');
    if (titleEl) {
      titleEl.textContent = `${dayLabel}, Ngày ${dateFormatted}`;
    }

    const targetIso = targetDate.toISOString().slice(0, 10);
    const matchedWeek = appState.generatedWeeks.find(w => targetIso >= w.startDate && targetIso <= w.endDate) || appState.generatedWeeks[6];
    const weekTitleEl = document.getElementById('todayHeaderWeekTitle');
    if (weekTitleEl && matchedWeek) {
      weekTitleEl.textContent = matchedWeek.customTitle ? `${matchedWeek.customTitle} (${matchedWeek.dateRangeStr})` : matchedWeek.fullLabel;
    }

    const selectedClass = document.getElementById('todayFilterClass')?.value || 'all';
    const selectedRoom = document.getElementById('todayFilterRoom')?.value || 'all';

    let todayBookings = appState.bookings.filter(b =>
      b.week === matchedWeek?.weekNumber &&
      b.dayOfWeek === dayOfWeek
    );

    if (selectedClass !== 'all') {
      todayBookings = todayBookings.filter(b => b.className === selectedClass);
    }
    if (selectedRoom !== 'all') {
      todayBookings = todayBookings.filter(b => b.room === selectedRoom);
    }

    const countEl = document.getElementById('todayTotalCountTxt');
    if (countEl) countEl.textContent = `${todayBookings.length} tiết`;

    const container = document.getElementById('todayScheduleCardsContainer');
    if (!container) return;

    if (appState.rooms.length === 0) {
      container.innerHTML = `
        <div class="bg-white rounded-3xl p-8 text-center text-slate-400 border border-slate-200">
          <i class="fa-solid fa-chalkboard text-3xl text-slate-300 mb-2 block"></i>
          Chưa có phòng thực hành nào. Quản trị viên vui lòng vào mục Quản trị để khai báo phòng.
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <!-- BUỔI SÁNG -->
      <div class="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-4 border-b border-amber-200/60 flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              <i class="fa-solid fa-sun"></i>
            </div>
            <div>
              <h2 class="text-sm font-black text-slate-800 uppercase tracking-wide">Buổi Sáng (Tiết 1 đến Tiết 5)</h2>
              <p class="text-[11px] text-amber-800/80 font-medium">Khung giờ sáng: 07:15 – 11:30</p>
            </div>
          </div>
          <span class="text-xs font-bold text-amber-700 bg-amber-100/70 px-3 py-1 rounded-full border border-amber-200">
            5 tiết sáng
          </span>
        </div>
        <div class="p-6 divide-y divide-slate-100">
          ${renderTodayPeriodRows('sang', matchedWeek?.weekNumber, dayOfWeek, todayBookings, selectedClass, selectedRoom)}
        </div>
      </div>

      <!-- BUỔI CHIỀU -->
      <div class="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="bg-gradient-to-r from-indigo-50 to-blue-50 px-6 py-4 border-b border-indigo-200/60 flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              <i class="fa-solid fa-moon"></i>
            </div>
            <div>
              <h2 class="text-sm font-black text-slate-800 uppercase tracking-wide">Buổi Chiều (Tiết 1 đến Tiết 5)</h2>
              <p class="text-[11px] text-indigo-800/80 font-medium">Khung giờ chiều: 13:15 – 17:30</p>
            </div>
          </div>
          <span class="text-xs font-bold text-indigo-700 bg-indigo-100/70 px-3 py-1 rounded-full border border-indigo-200">
            5 tiết chiều
          </span>
        </div>
        <div class="p-6 divide-y divide-slate-100">
          ${renderTodayPeriodRows('chieu', matchedWeek?.weekNumber, dayOfWeek, todayBookings, selectedClass, selectedRoom)}
        </div>
      </div>
    `;
  }

  function renderTodayPeriodRows(session, weekNum, dayOfWeek, todayBookings, selectedClass, selectedRoom) {
    let html = '';

    for (let p = 1; p <= 5; p++) {
      const timeStr = PERIOD_TIMES[session][p];
      const roomsToDisplay = selectedRoom === 'all'
        ? appState.rooms
        : appState.rooms.filter(r => r.name === selectedRoom);

      html += `
        <div class="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row gap-4 items-start">
          <div class="w-full md:w-36 flex-shrink-0 bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center">
            <span class="inline-block text-xs font-black text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200 mb-1">
              Tiết ${p}
            </span>
            <p class="text-[11px] font-mono font-semibold text-slate-500">${timeStr}</p>
          </div>

          <div class="flex-grow grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
      `;

      roomsToDisplay.forEach(room => {
        const booking = todayBookings.find(b =>
          b.session === session &&
          b.period === p &&
          b.room === room.name
        );

        if (booking) {
          const isTargetClass = selectedClass !== 'all' && booking.className === selectedClass;

          html += `
            <div class="p-4 rounded-2xl border transition-all ${
              isTargetClass
                ? 'bg-blue-50/90 border-blue-500 shadow-md ring-2 ring-blue-500/20'
                : 'bg-white border-slate-200 shadow-xs hover:border-brand-400'
            }">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-slate-600 flex items-center gap-1.5 truncate max-w-[150px]">
                  <i class="fa-solid fa-chalkboard text-brand-600"></i> ${room.name}
                </span>
                <span class="px-2.5 py-1 rounded-lg text-xs font-black bg-brand-600 text-white shadow-xs">
                  Lớp ${booking.className}
                </span>
              </div>
              <p class="text-xs font-bold text-slate-800 line-clamp-1 mb-1" title="${booking.lesson || booking.subject}">
                ${booking.lesson || booking.subject}
              </p>
              <div class="text-[11px] text-slate-500 flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                <span class="font-medium text-slate-700 truncate max-w-[120px]">
                  <i class="fa-solid fa-user-tie mr-1 text-slate-400"></i> ${booking.teacherName}
                </span>
                <span class="text-brand-700 font-semibold truncate max-w-[100px]">
                  ${booking.subject}
                </span>
              </div>
            </div>
          `;
        } else {
          html += `
            <div class="p-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 flex items-center justify-between text-slate-400">
              <div class="flex items-center gap-2">
                <i class="fa-solid fa-door-open text-slate-300"></i>
                <span class="text-xs font-medium text-slate-600">${room.name}</span>
              </div>
              <span class="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">
                Phòng trống
              </span>
            </div>
          `;
        }
      });

      html += `</div></div>`;
    }

    return html;
  }

  // =========================================================================
  // VIEW 2: SỔ THỰC HÀNH & ĐĂNG KÝ THEO TUẦN (TIMETABLE GRID)
  // =========================================================================
  function renderTimetableGrid() {
    const curWeek = appState.selectedWeekNumber;
    const curRoom = appState.rooms.find(r => r.id === appState.selectedRoomId) || appState.rooms[0];
    const weekObj = appState.generatedWeeks.find(w => w.weekNumber === curWeek);
    if (!weekObj || !curRoom) return;

    for (let day = 2; day <= 7; day++) {
      const dInfo = weekObj.dayDates[day];
      const thSang = document.getElementById(`th-day-${day}-sang`);
      const thChieu = document.getElementById(`th-day-${day}-chieu`);
      const dayTitle = `${DAY_NAMES[day]} (${dInfo.shortStr})`;
      if (thSang) thSang.textContent = dayTitle;
      if (thChieu) thChieu.textContent = dayTitle;
    }

    const morningBody = document.getElementById('morningGridBody');
    const afternoonBody = document.getElementById('afternoonGridBody');

    if (morningBody) morningBody.innerHTML = buildSessionRows('sang', curWeek, curRoom.name, weekObj);
    if (afternoonBody) afternoonBody.innerHTML = buildSessionRows('chieu', curWeek, curRoom.name, weekObj);

    // Banner details
    const bannerRoom = document.getElementById('bannerRoomBadge');
    const bannerTitle = document.getElementById('bannerWeekTitle');
    const bannerRange = document.getElementById('bannerWeekDateRange');
    const bannerCustom = document.getElementById('bannerWeekCustomName');
    const bannerDetails = document.getElementById('bannerRoomDetails');

    if (bannerRoom) bannerRoom.textContent = curRoom.name;
    if (bannerTitle) bannerTitle.textContent = `SỔ THỰC HÀNH - TUẦN ${curWeek}`;
    if (bannerRange) bannerRange.textContent = `(${weekObj.dateRangeStr})`;
    if (bannerCustom) bannerCustom.textContent = weekObj.customTitle ? `• ${weekObj.customTitle}` : '';

    if (bannerDetails) {
      bannerDetails.innerHTML = `
        <span><i class="fa-solid fa-desktop mr-1 text-brand-400"></i> ${curRoom.totalComputers || 0} máy học sinh</span>
        <span><i class="fa-solid fa-tv mr-1 text-brand-400"></i> ${curRoom.projector || 'Máy chiếu'}</span>
        <span><i class="fa-solid fa-location-dot mr-1 text-brand-400"></i> ${curRoom.fullName || curRoom.name}</span>
        <span><i class="fa-solid fa-user-tie mr-1 text-brand-400"></i> Phụ trách: ${curRoom.managerName || 'Quản trị viên'}</span>
      `;
    }

    const locked = isWeekLocked(curWeek);
    const statusTxt = document.getElementById('statWeekStatusTxt');
    if (statusTxt) {
      statusTxt.textContent = locked ? 'Đã khóa sổ đăng ký' : 'Đang mở đăng ký';
      statusTxt.className = locked
        ? 'text-xs font-bold px-3 py-1.5 rounded-xl bg-red-100 text-red-700 border border-red-200'
        : 'text-xs font-bold px-3 py-1.5 rounded-xl bg-white/10 text-emerald-300 border border-white/10';
    }
  }

  function buildSessionRows(session, week, roomName, weekObj) {
    let html = '';
    const locked = isWeekLocked(week);

    for (let period = 1; period <= 5; period++) {
      const timeStr = PERIOD_TIMES[session][period];

      html += `<tr class="hover:bg-slate-50/50 transition">`;
      html += `
        <td class="py-3 px-2 text-center border-r border-slate-200 bg-slate-50/80">
          <span class="block font-black text-slate-800 text-sm">Tiết ${period}</span>
          <span class="block text-[10px] text-slate-400 font-mono mt-0.5">${timeStr}</span>
        </td>
      `;

      for (let day = 2; day <= 7; day++) {
        const booking = appState.bookings.find(b =>
          b.week === week &&
          b.room === roomName &&
          b.session === session &&
          b.dayOfWeek === day &&
          b.period === period
        );

        html += `<td class="p-2 border-r border-slate-200 align-top h-24 timetable-slot">`;

        if (booking) {
          const hasStartSign = !!booking.signStart;
          const isMine = booking.teacherEmail === appState.currentUser?.email;

          html += `
            <div class="h-full rounded-xl p-2.5 bg-white border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between group cursor-pointer border-l-4 ${isMine ? 'border-l-brand-600' : 'border-l-slate-400'}" onclick="openDetailModal('${booking.id}')">
              <div>
                <div class="flex items-center justify-between gap-1 mb-1">
                  <span class="px-1.5 py-0.5 rounded text-[11px] font-black ${isMine ? 'bg-brand-50 text-brand-700 border border-brand-200' : 'bg-slate-100 text-slate-700'}">
                    ${booking.className || 'Lớp'}
                  </span>
                  <span class="text-[11px] font-bold text-slate-700 truncate max-w-[100px]" title="${booking.teacherName}">
                    ${booking.teacherName}
                  </span>
                </div>
                <p class="text-[11px] font-semibold text-slate-800 line-clamp-1" title="${booking.lesson || booking.subject}">
                  ${booking.lesson || booking.subject}
                </p>
                <p class="text-[10px] text-slate-400 line-clamp-1">${booking.subject || ''}</p>
              </div>

              <div class="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                <span class="${hasStartSign ? 'text-emerald-600 font-bold' : 'text-amber-600 font-medium'}">
                  ${hasStartSign ? '<i class="fa-solid fa-signature"></i> Đã ký' : '<i class="fa-regular fa-clock"></i> Chưa ký'}
                </span>
                <span class="text-slate-400">${isMine ? '(Của bạn)' : ''}</span>
              </div>
            </div>
          `;
        } else {
          if (locked) {
            html += `
              <div class="h-full rounded-xl border border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center text-slate-300 text-center p-2">
                <i class="fa-solid fa-lock text-xs mb-1"></i>
                <span class="text-[10px]">Đã khóa</span>
              </div>
            `;
          } else {
            html += `
              <button onclick="quickOpenBooking('${session}', ${day}, ${period})" class="w-full h-full rounded-xl border border-dashed border-slate-200 hover:border-brand-500 hover:bg-brand-50/40 text-slate-300 hover:text-brand-600 flex flex-col items-center justify-center transition group">
                <i class="fa-solid fa-plus text-xs group-hover:scale-125 transition-transform mb-1"></i>
                <span class="text-[10px] font-semibold text-slate-400 group-hover:text-brand-700">Đăng ký</span>
              </button>
            `;
          }
        }

        html += `</td>`;
      }

      html += `</tr>`;
    }

    return html;
  }

  // ================= VIEW 3: STANDARD 8-COLUMN TABLE =================
  function renderStandardTable() {
    const curWeek = appState.selectedWeekNumber;
    const curRoom = appState.rooms.find(r => r.id === appState.selectedRoomId) || appState.rooms[0];
    const weekObj = appState.generatedWeeks.find(w => w.weekNumber === curWeek);
    if (!weekObj || !curRoom) return;

    const tbody = document.getElementById('standardTableBody');
    const badge = document.getElementById('standardTableInfoBadge');
    if (badge) badge.textContent = `${weekObj.label} | ${curRoom.name}`;

    const searchTxt = (document.getElementById('tableSearchInput')?.value || '').toLowerCase().trim();
    const sessionFilter = document.getElementById('tableSessionFilter')?.value || 'all';

    let list = appState.bookings.filter(b => b.week === curWeek && b.room === curRoom.name);

    if (sessionFilter !== 'all') {
      list = list.filter(b => b.session === sessionFilter);
    }

    if (searchTxt) {
      list = list.filter(b =>
        (b.teacherName || '').toLowerCase().includes(searchTxt) ||
        (b.className || '').toLowerCase().includes(searchTxt) ||
        (b.subject || '').toLowerCase().includes(searchTxt) ||
        (b.lesson || '').toLowerCase().includes(searchTxt)
      );
    }

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="py-12 text-center text-slate-400 text-xs">
            <i class="fa-regular fa-folder-open text-2xl mb-2 block text-slate-300"></i>
            Chưa có tiết thực hành nào được đăng ký trong tuần này.
          </td>
        </tr>
      `;
      return;
    }

    const u = appState.currentUser;

    tbody.innerHTML = list.map(b => {
      const isMine = u?.email === b.teacherEmail || u?.role === 'admin';

      return `
        <tr class="hover:bg-slate-50/70 transition">
          <td class="py-3 px-3 text-center border-r border-slate-200 font-bold text-slate-800 bg-slate-50/40">
            <div>${b.dayName}</div>
            <span class="inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0.2 rounded ${b.session === 'sang' ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'}">
              ${b.session === 'sang' ? 'Sáng' : 'Chiều'}
            </span>
          </td>
          <td class="py-3 px-2 text-center border-r border-slate-200 font-black text-slate-900 text-sm">${b.period}</td>
          <td class="py-3 px-3 border-r border-slate-200">
            <div class="font-bold text-slate-900">${b.teacherName}</div>
            <div class="text-[11px] text-brand-600 font-semibold">${b.className} • ${b.subject}</div>
            <div class="text-[10px] text-slate-400 truncate">${b.lesson || ''}</div>
          </td>
          <td class="py-3 px-3 border-r border-slate-200 text-slate-700">${b.statusStart || 'Bình thường'}</td>
          <td class="py-3 px-2 text-center border-r border-slate-200">
            ${b.signStart
              ? `<span class="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded text-[11px]">
                  <i class="fa-solid fa-check"></i> ${b.signStart}
                </span>`
              : (isMine
                  ? `<button onclick="openSignModal('${b.id}', 'start')" class="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold">Ký đầu giờ</button>`
                  : '<span class="text-slate-300 text-[10px]">Chưa ký</span>')
            }
          </td>
          <td class="py-3 px-3 border-r border-slate-200 text-slate-700">${b.statusEnd || ''}</td>
          <td class="py-3 px-2 text-center border-r border-slate-200">
            ${b.signEnd
              ? `<span class="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded text-[11px]">
                  <i class="fa-solid fa-check"></i> ${b.signEnd}
                </span>`
              : (isMine && b.signStart
                  ? `<button onclick="openSignModal('${b.id}', 'end')" class="px-2 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded text-[10px] font-bold">Ký cuối giờ</button>`
                  : '<span class="text-slate-300 text-[10px]">Chưa ký</span>')
            }
          </td>
          <td class="py-3 px-3 border-r border-slate-200 text-slate-500 text-[11px]">${b.note || '—'}</td>
          <td class="py-3 px-2 text-center">
            <button onclick="openDetailModal('${b.id}')" class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-brand-600 transition">
              <i class="fa-solid fa-eye"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  window.filterStandardTable = function () {
    renderStandardTable();
  };

  // =========================================================================
  // VIEW 4: ADMIN PANEL (CHỈ DÀNH CHO QUẢN TRỊ VIÊN)
  // =========================================================================
  window.switchAdminTab = function (tabName) {
    if (appState.currentUser?.role !== 'admin') return;
    appState.adminActiveSubTab = tabName;

    ['rooms', 'classes', 'users', 'weeks'].forEach(t => {
      const btn = document.getElementById(`adminTabBtn-${t}`);
      const panel = document.getElementById(`adminPanel-${t}`);

      if (btn) {
        if (t === tabName) {
          btn.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-white text-purple-700 shadow-sm border border-slate-200 flex items-center gap-2';
        } else {
          btn.className = 'px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-2';
        }
      }

      if (panel) {
        if (t === tabName) panel.classList.remove('hidden');
        else panel.classList.add('hidden');
      }
    });

    renderAdminPanel();
  };

  function renderAdminPanel() {
    if (appState.currentUser?.role !== 'admin') return;
    renderAdminRoomsList();
    renderAdminClassesList();
    renderAdminUsersList();
    renderAdminWeeksList();
  }

  // SUB-TAB 1: ROOMS
  function renderAdminRoomsList() {
    const tbody = document.getElementById('adminRoomsTableBody');
    if (!tbody) return;

    if (appState.rooms.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="py-8 text-center text-slate-400">
            Chưa có phòng thực hành nào. Vui lòng bấm nút "+ Khai báo phòng thực hành mới" để thêm phòng!
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = appState.rooms.map(r => `
      <tr class="hover:bg-slate-50 transition">
        <td class="py-2.5 px-3 font-bold text-slate-900 flex items-center gap-2">
          <i class="fa-solid fa-chalkboard text-brand-600"></i>
          <span>${r.name}</span>
        </td>
        <td class="py-2.5 px-3 text-slate-600">${r.fullName || '—'}</td>
        <td class="py-2.5 px-3 text-center font-bold text-slate-800">${r.totalComputers || 0} máy</td>
        <td class="py-2.5 px-3 text-slate-600">${r.projector || '—'}</td>
        <td class="py-2.5 px-3 text-slate-700">${r.managerName || '—'}</td>
        <td class="py-2.5 px-3 text-center">
          <button onclick="editRoom('${r.id}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold mr-1">
            <i class="fa-solid fa-pen mr-1"></i> Sửa
          </button>
          <button onclick="deleteRoom('${r.id}')" class="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-[10px] font-bold">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }

  window.openAddRoomModal = function () {
    if (appState.currentUser?.role !== 'admin') return;
    document.getElementById('roomEditId').value = '';
    document.getElementById('roomModalTitle').textContent = 'Khai Báo Phòng Thực Hành Mới';
    document.getElementById('roomNameInput').value = '';
    document.getElementById('roomLocationInput').value = '';
    document.getElementById('roomComputersInput').value = '36';
    document.getElementById('roomProjectorInput').value = 'Máy chiếu HDMI';
    document.getElementById('roomManagerInput').value = appState.currentUser?.name || '';
    document.getElementById('roomModal')?.classList.remove('hidden');
  };

  window.editRoom = function (roomId) {
    if (appState.currentUser?.role !== 'admin') return;
    const r = appState.rooms.find(x => x.id === roomId);
    if (!r) return;

    document.getElementById('roomEditId').value = r.id;
    document.getElementById('roomModalTitle').textContent = 'Chỉnh Sửa Thông Tin Phòng';
    document.getElementById('roomNameInput').value = r.name;
    document.getElementById('roomLocationInput').value = r.fullName || '';
    document.getElementById('roomComputersInput').value = r.totalComputers || 36;
    document.getElementById('roomProjectorInput').value = r.projector || '';
    document.getElementById('roomManagerInput').value = r.managerName || '';
    document.getElementById('roomModal')?.classList.remove('hidden');
  };

  window.closeRoomModal = function () {
    document.getElementById('roomModal')?.classList.add('hidden');
  };

  window.handleRoomSubmit = function (e) {
    e.preventDefault();
    if (appState.currentUser?.role !== 'admin') return;

    const editId = document.getElementById('roomEditId').value;
    const name = document.getElementById('roomNameInput').value.trim();
    const loc = document.getElementById('roomLocationInput').value.trim();
    const comps = parseInt(document.getElementById('roomComputersInput').value) || 36;
    const proj = document.getElementById('roomProjectorInput').value.trim();
    const mgr = document.getElementById('roomManagerInput').value.trim();

    if (!name) return;

    if (editId) {
      const r = appState.rooms.find(x => x.id === editId);
      if (r) {
        const oldName = r.name;
        r.name = name;
        r.fullName = loc || name;
        r.totalComputers = comps;
        r.workingComputers = comps;
        r.projector = proj;
        r.managerName = mgr;

        appState.bookings.forEach(b => {
          if (b.room === oldName) b.room = name;
        });
      }
    } else {
      const newRoom = {
        id: `room_${Date.now()}`,
        name: name,
        fullName: loc || name,
        totalComputers: comps,
        workingComputers: comps,
        damagedComputers: 0,
        projector: proj,
        managerName: mgr,
        status: 'active'
      };
      appState.rooms.push(newRoom);
      if (!appState.selectedRoomId) appState.selectedRoomId = newRoom.id;
    }

    saveState();
    closeRoomModal();
    renderAll();
    showToast(`Đã lưu phòng thực hành: ${name}`);
  };

  window.deleteRoom = function (roomId) {
    if (appState.currentUser?.role !== 'admin') return;
    const r = appState.rooms.find(x => x.id === roomId);
    if (!r) return;

    if (!confirm(`Bạn có chắc chắn muốn xóa phòng "${r.name}" không?`)) return;

    appState.rooms = appState.rooms.filter(x => x.id !== roomId);
    if (appState.selectedRoomId === roomId) {
      appState.selectedRoomId = appState.rooms[0]?.id || '';
    }

    saveState();
    renderAll();
    showToast(`Đã xóa phòng "${r.name}"`);
  };

  // SUB-TAB 2: CLASSES
  function renderAdminClassesList() {
    const container = document.getElementById('adminClassesPillsContainer');
    const countTxt = document.getElementById('classesCountTxt');
    if (!container) return;

    if (countTxt) countTxt.textContent = appState.classes.length;

    if (appState.classes.length === 0) {
      container.innerHTML = `<span class="text-xs text-slate-400">Chưa có lớp nào được khai báo.</span>`;
      return;
    }

    container.innerHTML = appState.classes.map(c => `
      <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200">
        <span>${c}</span>
        <button onclick="deleteClass('${c}')" class="text-slate-400 hover:text-red-600 transition" title="Xóa lớp này">
          <i class="fa-solid fa-xmark text-[11px]"></i>
        </button>
      </span>
    `).join('');
  }

  window.handleBatchAddClasses = function () {
    if (appState.currentUser?.role !== 'admin') return;
    const input = document.getElementById('newClassInput');
    const val = input.value.trim();
    if (!val) return;

    const items = val.split(/[,;\n]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
    let addedCount = 0;

    items.forEach(c => {
      if (!appState.classes.includes(c)) {
        appState.classes.push(c);
        addedCount++;
      }
    });

    appState.classes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    input.value = '';
    saveState();
    renderAll();
    showToast(`Đã thêm thành công ${addedCount} lớp vào danh sách!`);
  };

  window.deleteClass = function (className) {
    if (appState.currentUser?.role !== 'admin') return;
    appState.classes = appState.classes.filter(c => c !== className);
    saveState();
    renderAll();
  };

  window.clearAllClasses = function () {
    if (appState.currentUser?.role !== 'admin') return;
    if (!confirm('Bạn có chắc chắn muốn xóa tất cả các lớp đã khai báo?')) return;
    appState.classes = [];
    saveState();
    renderAll();
  };

  // SUB-TAB 3: USERS (BẢO VỆ TUYỆT ĐỐI KHÔNG CHO GV HẠ QUYỀN ADMIN)
  function renderAdminUsersList() {
    const tbody = document.getElementById('adminUsersTableBody');
    if (!tbody) return;

    tbody.innerHTML = appState.users.map(u => {
      const isAdmin = u.role === 'admin';
      const isSelf = u.email === appState.currentUser?.email;

      return `
        <tr class="hover:bg-slate-50 transition">
          <td class="py-2.5 px-3 font-bold text-slate-900 flex items-center gap-2">
            <img src="${u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'}" class="w-6 h-6 rounded-full object-cover">
            <span>${u.name}</span>
          </td>
          <td class="py-2.5 px-3 font-mono text-slate-700">${u.email}</td>
          <td class="py-2.5 px-3 font-mono text-slate-500">${u.phone || '—'}</td>
          <td class="py-2.5 px-3 text-slate-600">${u.department || 'Giáo viên'}</td>
          <td class="py-2.5 px-3 text-center">
            ${isAdmin
              ? '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">Admin Quản trị</span>'
              : '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">Giáo viên</span>'
            }
          </td>
          <td class="py-2.5 px-3 text-center">
            ${!isSelf ? `
              <button onclick="toggleUserRole('${u.email}')" class="px-2 py-1 rounded text-[10px] font-semibold border ${
                isAdmin ? 'border-slate-300 text-slate-600 hover:bg-slate-100' : 'border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100'
              } mr-1">
                ${isAdmin ? 'Hạ xuống GV' : 'Phong Admin'}
              </button>
              <button onclick="deleteUser('${u.email}')" class="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-[10px] font-bold">
                <i class="fa-solid fa-trash"></i>
              </button>
            ` : '<span class="text-slate-300 text-[10px]">(Đang dùng - Không thể đổi)</span>'}
          </td>
        </tr>
      `;
    }).join('');
  }

  window.openAddUserModal = function () {
    if (appState.currentUser?.role !== 'admin') return;
    document.getElementById('userEditEmailOriginal').value = '';
    document.getElementById('userModalTitle').textContent = 'Khai Báo Tài Khoản Người Dùng Mới';
    document.getElementById('userNameInput').value = '';
    document.getElementById('userEmailInput').value = '';
    document.getElementById('userPhoneInput').value = '';
    document.getElementById('userDeptInput').value = 'Tổ Tin học';
    document.getElementById('userRoleSelect').value = 'teacher';
    document.getElementById('userModal')?.classList.remove('hidden');
  };

  window.closeUserModal = function () {
    document.getElementById('userModal')?.classList.add('hidden');
  };

  window.handleUserSubmit = function (e) {
    e.preventDefault();
    if (appState.currentUser?.role !== 'admin') return;

    const name = document.getElementById('userNameInput').value.trim();
    const email = document.getElementById('userEmailInput').value.trim().toLowerCase();
    const phone = document.getElementById('userPhoneInput').value.trim();
    const dept = document.getElementById('userDeptInput').value.trim();
    const role = document.getElementById('userRoleSelect').value;

    if (!name || !email) return;

    const existingIdx = appState.users.findIndex(u => u.email === email);
    const userData = {
      email: email,
      name: name,
      phone: phone,
      department: dept,
      role: role,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      signature: name
    };

    if (existingIdx >= 0) {
      appState.users[existingIdx] = userData;
    } else {
      appState.users.push(userData);
    }

    saveState();
    closeUserModal();
    renderAll();
    showToast(`Đã lưu tài khoản Gmail: ${email}`);
  };

  window.deleteUser = function (email) {
    if (appState.currentUser?.role !== 'admin') return;
    if (email === appState.currentUser?.email) {
      alert('Bạn không thể tự xóa tài khoản của chính mình!');
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn xóa người dùng "${email}" không?`)) return;
    appState.users = appState.users.filter(u => u.email !== email);
    saveState();
    renderAll();
    showToast(`Đã xóa tài khoản: ${email}`);
  };

  // CHỈ ADMIN MỚI ĐƯỢC PHÉP ĐỔI VAI TRÒ
  window.toggleUserRole = function (email) {
    if (appState.currentUser?.role !== 'admin') {
      alert('Chỉ Quản trị viên (Admin) mới có quyền phân quyền người dùng!');
      return;
    }

    if (email === appState.currentUser?.email) {
      alert('Bạn không thể tự hạ quyền Admin của chính mình!');
      return;
    }

    const u = appState.users.find(x => x.email === email);
    if (!u) return;

    u.role = u.role === 'admin' ? 'teacher' : 'admin';
    saveState();
    renderAll();
    showToast(`Đã đổi vai trò của ${u.name} thành: ${u.role === 'admin' ? 'Admin' : 'Giáo viên'}`);
  };

  window.openImportUsersModal = function () {
    if (appState.currentUser?.role !== 'admin') return;
    document.getElementById('importUsersModal')?.classList.remove('hidden');
  };

  window.closeImportUsersModal = function () {
    document.getElementById('importUsersModal')?.classList.add('hidden');
  };

  window.downloadSampleUserExcelTemplate = function () {
    if (typeof XLSX === 'undefined') return;

    const rows = [
      ['Họ và tên', 'Gmail', 'Số điện thoại', 'Tổ bộ môn', 'Vai trò (admin/giáo viên)'],
      ['Thầy Phạm Đình Thanh', 'thanh.gv@gmail.com', '0912345678', 'Tổ Tin học', 'giáo viên'],
      ['Cô Vũ Thị Ý', 'vuthi.y@gmail.com', '0987654321', 'Tổ Tin học', 'giáo viên'],
      ['Thầy Hoàng Quốc Việt', 'admin@gmail.com', '0905555555', 'Ban Giám Hiệu', 'admin']
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 24 }, { wch: 24 }, { wch: 16 }, { wch: 18 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Mau_Danh_Sach_Giao_Vien');
    XLSX.writeFile(wb, 'Mau_Danh_Sach_Giao_Vien_PhongMay.xlsx');
  };

  window.handleExcelUsersUpload = function (e) {
    if (appState.currentUser?.role !== 'admin') return;
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (evt) {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1 });

        let count = 0;
        for (let i = 1; i < json.length; i++) {
          const row = json[i];
          if (!row || row.length < 2) continue;

          const name = String(row[0] || '').trim();
          const email = String(row[1] || '').trim().toLowerCase();
          const phone = String(row[2] || '').trim();
          const dept = String(row[3] || '').trim();
          const roleStr = String(row[4] || '').toLowerCase().trim();
          const role = roleStr.includes('admin') ? 'admin' : 'teacher';

          if (name && email.includes('@')) {
            const idx = appState.users.findIndex(u => u.email === email);
            const userObj = {
              email: email,
              name: name,
              phone: phone,
              department: dept || 'Giáo viên',
              role: role,
              avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
              signature: name
            };

            if (idx >= 0) appState.users[idx] = userObj;
            else appState.users.push(userObj);
            count++;
          }
        }

        saveState();
        closeImportUsersModal();
        renderAll();
        showToast(`Đã nạp thành công ${count} tài khoản giáo viên từ file Excel!`);
      } catch (err) {
        console.error('Import users error', err);
        alert('Có lỗi khi đọc file Excel. Vui lòng đảm bảo file theo đúng mẫu!');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  window.exportUsersToExcel = function () {
    if (typeof XLSX === 'undefined') return;

    const rows = [
      ['STT', 'Họ và tên', 'Tài khoản Gmail', 'Số điện thoại', 'Tổ bộ môn', 'Phân quyền']
    ];

    appState.users.forEach((u, i) => {
      rows.push([
        i + 1,
        u.name,
        u.email,
        u.phone || '',
        u.department || '',
        u.role === 'admin' ? 'Quản trị viên (Admin)' : 'Giáo viên'
      ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 6 }, { wch: 24 }, { wch: 26 }, { wch: 16 }, { wch: 18 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Danh_Sach_Nguoi_Dung');
    XLSX.writeFile(wb, 'DANH_SACH_TAI_KHOAN_GMAIL_PHONG_MAY.xlsx');
    showToast('Đã xuất danh sách tài khoản Gmail ra file Excel!');
  };

  // SUB-TAB 4: WEEKS & CUSTOM NAMES
  function renderAdminWeeksList() {
    const tbody = document.getElementById('adminWeeksTableBody');
    if (!tbody) return;

    tbody.innerHTML = appState.generatedWeeks.map(w => {
      const locked = isWeekLocked(w.weekNumber);
      const customTitle = appState.weekCustomNames[w.weekNumber] || '';

      return `
        <tr class="hover:bg-slate-50 transition">
          <td class="py-2 px-3 text-center font-bold text-slate-800">${w.weekNumber}</td>
          <td class="py-2 px-3 font-mono text-[11px] text-slate-500">${w.dateRangeStr}</td>
          <td class="py-2 px-3">
            <input type="text" id="weekNameInput_${w.weekNumber}" value="${customTitle}" placeholder="Đặt tên riêng cho tuần (Ví dụ: Tuần 7: Thi đua...)" onchange="updateWeekCustomName(${w.weekNumber}, this.value)" class="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white font-medium">
          </td>
          <td class="py-2 px-3 text-center">
            <button onclick="toggleLockForWeek(${w.weekNumber})" class="px-2.5 py-1 rounded-lg text-[10px] font-bold ${
              locked ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            }">
              ${locked ? '<i class="fa-solid fa-lock mr-1"></i> Đã khóa sổ' : '<i class="fa-solid fa-lock-open mr-1"></i> Mở đăng ký'}
            </button>
          </td>
          <td class="py-2 px-3 text-center">
            <button onclick="selectWeek(${w.weekNumber}); switchView('timetable');" class="text-brand-600 hover:underline text-[11px] font-bold">
              Xem sổ
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  window.updateWeekCustomName = function (weekNum, newName) {
    if (appState.currentUser?.role !== 'admin') return;
    if (newName && newName.trim()) {
      appState.weekCustomNames[weekNum] = newName.trim();
    } else {
      delete appState.weekCustomNames[weekNum];
    }
    generateSchoolWeeks();
    saveState();
    renderWeekDropdown();
    showToast(`Đã cập nhật tên Tuần ${weekNum}!`);
  };

  // ADMIN MỞ SỔ / KHÓA SỔ
  window.toggleLockForWeek = function (weekNum) {
    if (appState.currentUser?.role !== 'admin') {
      alert('Chỉ Admin mới có quyền mở sổ hoặc khóa sổ đăng ký!');
      return;
    }

    const currentLocked = isWeekLocked(weekNum);
    appState.lockedWeeks[weekNum] = !currentLocked; // Đảo ngược trạng thái
    saveState();
    renderAll();
    showToast(appState.lockedWeeks[weekNum] ? `Đã KHÓA sổ Tuần ${weekNum}` : `Đã MỞ SỔ Tuần ${weekNum} cho giáo viên sửa/đăng ký`);
  };

  window.saveSchoolYearSettings = function () {
    if (appState.currentUser?.role !== 'admin') return;
    const y = document.getElementById('adminSchoolYearInput').value.trim();
    const s = document.getElementById('adminYearStartInput').value;
    const e = document.getElementById('adminYearEndInput').value;

    if (!y || !s || !e) return;

    appState.schoolYear = y;
    appState.yearStartDate = s;
    appState.yearEndDate = e;

    generateSchoolWeeks();
    saveState();
    renderAll();
    showToast('Đã lưu cấu hình năm học thành công!');
  };

  window.clearAllDataPrompt = function () {
    if (appState.currentUser?.role !== 'admin') return;
    if (!confirm('CẢNH BÁO: Thao tác này sẽ XÓA HẾT tất cả các tiết thực hành đã đăng ký và đưa hệ thống về trạng thái sạch ban đầu. Bạn có chắc chắn không?')) {
      return;
    }

    appState.bookings = [];
    appState.issues = [];
    saveState();
    renderAll();
    showToast('Đã xóa hết dữ liệu đăng ký thành công!');
  };

  // ================= ROOM SELECTION =================
  window.selectRoom = function (roomId) {
    appState.selectedRoomId = roomId;
    saveState();
    renderAll();
  };

  // ================= WEEK DROPDOWN NAVIGATION =================
  window.selectWeek = function (weekNum) {
    appState.selectedWeekNumber = weekNum;
    closeWeekDropdowns();
    saveState();
    renderAll();
  };

  window.changeWeek = function (delta) {
    const target = appState.selectedWeekNumber + delta;
    if (target >= 1 && target <= appState.generatedWeeks.length) {
      selectWeek(target);
    }
  };

  window.goToCurrentWeek = function () {
    selectWeek(appState.currentWeekNumber);
  };

  function renderWeekDropdown() {
    const curWeek = appState.generatedWeeks.find(w => w.weekNumber === appState.selectedWeekNumber) || appState.generatedWeeks[0];
    if (!curWeek) return;

    const selectedWeekLabel = document.getElementById('selectedWeekLabel');
    if (selectedWeekLabel) selectedWeekLabel.textContent = curWeek.label;

    const modalSelectedText = document.getElementById('modalSelectedWeekText');
    if (modalSelectedText) modalSelectedText.textContent = curWeek.label;

    const headerWeekBadge = document.getElementById('headerWeekBadge');
    if (headerWeekBadge) headerWeekBadge.textContent = curWeek.fullLabel;

    renderDropdownListItems('weekDropdownList', '');
    renderDropdownListItems('modalWeekDropdownList', '');
  }

  function renderDropdownListItems(containerId, filterKeyword = '') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const term = filterKeyword.toLowerCase().trim();

    const groups = {};
    appState.generatedWeeks.forEach(w => {
      const matchesSearch = !term ||
        w.label.toLowerCase().includes(term) ||
        w.monthGroup.includes(term) ||
        w.dateRangeStr.includes(term) ||
        `tuần ${w.weekNumber}`.includes(term);

      if (matchesSearch) {
        if (!groups[w.monthGroup]) groups[w.monthGroup] = [];
        groups[w.monthGroup].push(w);
      }
    });

    if (Object.keys(groups).length === 0) {
      container.innerHTML = `<div class="py-6 text-center text-slate-400 text-xs">Không tìm thấy tuần nào phù hợp</div>`;
      return;
    }

    let html = '';
    Object.keys(groups).forEach(month => {
      html += `
        <div class="py-1">
          <div class="px-4 py-1.5 text-xs font-black text-slate-800 tracking-wider">${month}</div>
          <div class="space-y-0.5">
      `;

      groups[month].forEach(w => {
        const isSelected = w.weekNumber === appState.selectedWeekNumber;
        const isCurrent = w.isCurrent;

        html += `
          <button type="button" onclick="selectWeek(${w.weekNumber})" class="w-full text-left px-5 py-2 flex items-center justify-between text-xs transition ${
            isSelected ? 'bg-blue-50/90 text-brand-700 font-bold' : 'hover:bg-slate-50 text-slate-700 font-medium'
          }">
            <div class="flex items-center gap-2 truncate">
              <span class="truncate">${w.label}</span>
              ${isCurrent ? '<span class="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 font-bold">Hiện tại</span>' : ''}
            </div>
            ${isSelected ? '<i class="fa-solid fa-check text-brand-600 text-xs"></i>' : ''}
          </button>
        `;
      });

      html += `</div></div>`;
    });

    container.innerHTML = html;
  }

  window.toggleWeekDropdown = function () {
    const menu = document.getElementById('weekDropdownMenu');
    if (!menu) return;
    const isHidden = menu.classList.contains('hidden');
    closeAllPopups();
    if (isHidden) {
      menu.classList.remove('hidden');
      const input = document.getElementById('weekSearchInput');
      if (input) {
        input.value = '';
        renderDropdownListItems('weekDropdownList', '');
        setTimeout(() => input.focus(), 50);
      }
    }
  };

  window.filterWeeksDropdown = function (val) {
    renderDropdownListItems('weekDropdownList', val);
  };

  window.toggleModalWeekDropdown = function () {
    const menu = document.getElementById('modalWeekDropdownMenu');
    if (!menu) return;
    menu.classList.toggle('hidden');
  };

  window.filterModalWeeksDropdown = function (val) {
    renderDropdownListItems('modalWeekDropdownList', val);
  };

  function closeWeekDropdowns() {
    document.getElementById('weekDropdownMenu')?.classList.add('hidden');
    document.getElementById('modalWeekDropdownMenu')?.classList.add('hidden');
  }

  // =========================================================================
  // NẠP FILE BÁO GIẢNG & ĐĂNG KÝ THỰC HÀNH (MẪU BÁO GIẢNG.XLSX)
  // =========================================================================
  window.openBaoGiangModal = function () {
    const modal = document.getElementById('baoGiangModal');
    if (!modal) return;

    // Populate Target Room Select
    const roomSelect = document.getElementById('baoGiangTargetRoomSelect');
    if (roomSelect) {
      roomSelect.innerHTML = appState.rooms.map(r => `<option value="${r.name}">${r.name} (${r.totalComputers || 0} máy)</option>`).join('');
    }

    // Reset upload preview
    document.getElementById('baoGiangUploadZone').classList.remove('hidden');
    document.getElementById('baoGiangPreviewContainer').classList.add('hidden');
    document.getElementById('btnSubmitBaoGiangBooking').classList.add('hidden');
    document.getElementById('baoGiangFileInput').value = '';

    modal.classList.remove('hidden');
  };

  window.closeBaoGiangModal = function () {
    document.getElementById('baoGiangModal')?.classList.add('hidden');
  };

  window.handleBaoGiangFileUpload = function (e) {
    const file = e.target.files[0];
    if (!file) return;

    if (typeof XLSX === 'undefined') {
      alert('Thư viện Excel đang tải, vui lòng thử lại sau giây lát!');
      return;
    }

    const reader = new FileReader();
    reader.onload = function (evt) {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];

        // Đọc thông tin giáo viên & tuần học từ hàng 6
        const row6Cell = ws['A6'] || ws['B6'] || ws['C6'];
        const gvText = String(row6Cell?.v || '');

        let teacherName = appState.currentUser?.name || 'Giáo viên';
        let weekNum = appState.selectedWeekNumber;

        const gvMatch = gvText.match(/Giáo viên:\s*([^-]+)/i);
        if (gvMatch) teacherName = gvMatch[1].trim();

        const weekMatch = gvText.match(/Tuần\s*(\d+)/i);
        if (weekMatch) weekNum = parseInt(weekMatch[1]);

        document.getElementById('baoGiangTeacherNameTxt').textContent = `Giáo viên: ${teacherName}`;
        document.getElementById('baoGiangWeekTxt').textContent = `Tuần học trong file: Tuần ${weekNum} (Năm học ${appState.schoolYear})`;

        // Quét các dòng bài dạy từ dòng 9 trở đi
        const lessons = [];
        let r = 9;

        while (true) {
          const thuCell = ws[XLSX.utils.encode_cell({ r: r - 1, c: 1 })]; // Cột B
          const buoiCell = ws[XLSX.utils.encode_cell({ r: r - 1, c: 2 })]; // Cột C
          const tietCell = ws[XLSX.utils.encode_cell({ r: r - 1, c: 3 })]; // Cột D
          const monCell = ws[XLSX.utils.encode_cell({ r: r - 1, c: 5 })]; // Cột F
          const lopCell = ws[XLSX.utils.encode_cell({ r: r - 1, c: 6 })]; // Cột G
          const ppctCell = ws[XLSX.utils.encode_cell({ r: r - 1, c: 7 })]; // Cột H
          const baiCell = ws[XLSX.utils.encode_cell({ r: r - 1, c: 8 })]; // Cột I

          const thuRaw = String(thuCell?.v || '').trim();
          const buoiRaw = String(buoiCell?.v || '').trim().toLowerCase();
          const tietRaw = String(tietCell?.v || '').trim();
          const monRaw = String(monCell?.v || '').trim();
          const lopRaw = String(lopCell?.v || '').trim();
          const ppctRaw = String(ppctCell?.v || '').trim();
          const baiRaw = String(baiCell?.v || '').trim();

          // Dừng khi không còn dữ liệu
          if (!thuRaw && !buoiRaw && !tietRaw && !monRaw && !lopRaw && r > 75) break;

          if (monRaw || lopRaw || baiRaw) {
            let dNum = 2;
            for (let d = 2; d <= 7; d++) {
              if (thuRaw.toLowerCase().includes(`thứ ${d}`) || thuRaw.toLowerCase().includes(`thu ${d}`)) {
                dNum = d;
                break;
              }
            }

            const session = buoiRaw.includes('chiều') || buoiRaw.includes('chieu') ? 'chieu' : 'sang';
            const tiet = parseInt(tietRaw) || 1;
            const isPractice = baiRaw.toLowerCase().includes('thực hành') ||
                               baiRaw.toLowerCase().includes('th)') ||
                               baiRaw.toLowerCase().includes('(th');

            lessons.push({
              index: lessons.length,
              week: weekNum,
              dayOfWeek: dNum,
              dayLabel: thuRaw.replace(/\n/g, ' '),
              session: session,
              period: tiet,
              subject: monRaw || 'Tin học',
              className: lopRaw || '',
              ppct: ppctRaw,
              lesson: baiRaw,
              isPractice: isPractice
            });
          }

          r++;
          if (r > 100) break; // Giới hạn an toàn
        }

        appState.tempBaoGiang = {
          teacherName: teacherName,
          weekNum: weekNum,
          lessons: lessons
        };

        renderBaoGiangPreviewTable();

        document.getElementById('baoGiangUploadZone').classList.add('hidden');
        document.getElementById('baoGiangPreviewContainer').classList.remove('hidden');
        document.getElementById('btnSubmitBaoGiangBooking').classList.remove('hidden');
      } catch (err) {
        console.error('Error parsing Bao Giang file', err);
        alert('Có lỗi khi đọc file Báo giảng. Vui lòng kiểm tra định dạng file Excel!');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  function renderBaoGiangPreviewTable() {
    const tbody = document.getElementById('baoGiangTableBody');
    const countEl = document.getElementById('baoGiangLessonsCount');
    if (!tbody || !appState.tempBaoGiang) return;

    const lessons = appState.tempBaoGiang.lessons;
    if (countEl) countEl.textContent = lessons.length;

    tbody.innerHTML = lessons.map(l => `
      <tr class="hover:bg-slate-50 transition ${l.isPractice ? 'bg-emerald-50/30' : ''}">
        <td class="py-2.5 px-3 text-center">
          <input type="checkbox" id="chk_bg_${l.index}" ${l.isPractice ? 'checked' : ''} class="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer">
        </td>
        <td class="py-2.5 px-3 font-bold text-slate-800">
          <div>${l.dayLabel}</div>
          <span class="text-[10px] font-semibold text-slate-500">${l.session === 'sang' ? 'Buổi Sáng' : 'Buổi Chiều'}</span>
        </td>
        <td class="py-2.5 px-2 text-center font-black text-slate-900 text-sm">${l.period}</td>
        <td class="py-2.5 px-2 font-bold text-brand-700">${l.className}</td>
        <td class="py-2.5 px-3 text-slate-600">${l.subject}</td>
        <td class="py-2.5 px-3 text-slate-800">
          <div class="font-semibold">${l.lesson}</div>
          ${l.ppct ? `<span class="text-[10px] text-slate-400">Tiết PPCT: ${l.ppct}</span>` : ''}
          ${l.isPractice ? '<span class="ml-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">Thực hành</span>' : ''}
        </td>
      </tr>
    `).join('');
  }

  window.selectAllBaoGiang = function (status) {
    if (!appState.tempBaoGiang) return;
    appState.tempBaoGiang.lessons.forEach(l => {
      const chk = document.getElementById(`chk_bg_${l.index}`);
      if (chk) chk.checked = status;
    });
  };

  window.selectOnlyPracticeBaoGiang = function () {
    if (!appState.tempBaoGiang) return;
    appState.tempBaoGiang.lessons.forEach(l => {
      const chk = document.getElementById(`chk_bg_${l.index}`);
      if (chk) chk.checked = !!l.isPractice;
    });
  };

  // NỘP ĐĂNG KÝ TỪ BÁO GIẢNG VỚI NGUYÊN TẮC:
  // "Ai đăng ký trước thì hiện trước, ai đăng ký sau thì KHÔNG ĐƯỢC phải báo Admin hoặc nhờ người đăng ký hủy"
  window.submitBaoGiangBookings = function () {
    if (!appState.tempBaoGiang) return;

    const targetRoom = document.getElementById('baoGiangTargetRoomSelect').value;
    const weekNum = appState.tempBaoGiang.weekNum;

    // Kiểm tra khóa sổ
    if (isWeekLocked(weekNum) && appState.currentUser?.role !== 'admin') {
      alert(`Tuần ${weekNum} đã bị khóa sổ đăng ký. Bạn không thể nạp đăng ký mới vào tuần này!`);
      return;
    }

    const u = appState.currentUser;
    const lessons = appState.tempBaoGiang.lessons;

    let successCount = 0;
    const conflicts = [];

    lessons.forEach(l => {
      const chk = document.getElementById(`chk_bg_${l.index}`);
      if (!chk || !chk.checked) return;

      // KIỂM TRA TRÙNG LỊCH (First-Come, First-Served)
      const existing = appState.bookings.find(b =>
        b.week === weekNum &&
        b.room === targetRoom &&
        b.session === l.session &&
        b.dayOfWeek === l.dayOfWeek &&
        b.period === l.period
      );

      if (existing) {
        // ĐÃ CÓ NGƯỜI ĐĂNG KÝ TRƯỚC -> TỪ CHỐI!
        conflicts.push({
          slot: `Thứ ${l.dayOfWeek} (${l.session === 'sang' ? 'Sáng' : 'Chiều'}) Tiết ${l.period}`,
          targetClass: l.className,
          existingTeacher: existing.teacherName,
          existingClass: existing.className,
          existingLesson: existing.lesson
        });
      } else {
        // PHÒNG TRỐNG -> ĐĂNG KÝ THÀNH CÔNG CHO GIÁO VIÊN NÀY
        const recId = `rec_${weekNum}_${l.session}_${l.dayOfWeek}_${l.period}_${Date.now()}_${Math.random()}`;
        appState.bookings.push({
          id: recId,
          week: weekNum,
          session: l.session,
          dayOfWeek: l.dayOfWeek,
          dayName: DAY_NAMES[l.dayOfWeek],
          dateLabel: l.dayLabel,
          period: l.period,
          room: targetRoom,
          className: l.className,
          subject: l.subject,
          lesson: l.lesson,
          teacherName: u.name || appState.tempBaoGiang.teacherName,
          teacherEmail: u.email,
          statusStart: 'Máy móc hoạt động tốt, sạch sẽ',
          signStart: '',
          signStartTime: '',
          statusEnd: '',
          signEnd: '',
          signEndTime: '',
          note: `Nạp từ lịch báo giảng (Tiết PPCT: ${l.ppct || '—'})`,
          isApproved: true
        });
        successCount++;
      }
    });

    saveState();
    closeBaoGiangModal();
    selectWeek(weekNum);
    renderAll();

    if (conflicts.length > 0) {
      // Hiển thị thông báo chi tiết về các tiết bị từ chối do đã có người đăng ký trước
      let msg = `ĐÃ ĐĂNG KÝ THÀNH CÔNG: ${successCount} tiết vào ${targetRoom}.\n\n`;
      msg += `⚠️ CÓ ${conflicts.length} TIẾT BỊ TỪ CHỐI DO ĐÃ CÓ NGƯỜI ĐĂNG KÝ TRƯỚC (Ai đăng ký trước giữ trước):\n`;
      conflicts.forEach(c => {
        msg += `• ${c.slot}: Đã được ${c.existingTeacher} đăng ký trước cho lớp ${c.existingClass} ("${c.existingLesson}").\n`;
      });
      msg += `\n👉 Nếu muốn đổi tiết này, vui lòng liên hệ giáo viên đã đăng ký để nhờ nhường lịch hoặc báo Admin để xóa!`;
      alert(msg);
    } else {
      if (typeof confetti === 'function') {
        confetti({ particleCount: 70, spread: 60 });
      }
      showToast(`Đã nạp và đăng ký thành công toàn bộ ${successCount} tiết vào ${targetRoom}!`);
    }
  };

  // =========================================================================
  // ĐĂNG KÝ THỦ CÔNG (ĐẢM BẢO CHẶT CHẼ RANH GIỚI VÀ FIRST-COME FIRST-SERVED)
  // =========================================================================
  window.openBookingModal = function () {
    const modal = document.getElementById('bookingModal');
    if (!modal) return;

    if (appState.rooms.length === 0) {
      alert('Chưa có phòng thực hành nào. Vui lòng liên hệ Admin khai báo phòng!');
      return;
    }

    if (appState.classes.length === 0) {
      alert('Chưa có danh sách lớp thực hành. Vui lòng liên hệ Admin khai báo lớp!');
      return;
    }

    // Kiểm tra khóa sổ: Giáo viên chỉ được đăng ký khi chưa khóa
    if (isWeekLocked(appState.selectedWeekNumber) && appState.currentUser?.role !== 'admin') {
      alert(`Tuần ${appState.selectedWeekNumber} đã bị khóa sổ đăng ký. Bạn không thể đăng ký mới!`);
      return;
    }

    populateBookingFormOptions();

    document.getElementById('bookingIdInput').value = '';
    document.getElementById('bookingModalTitle').textContent = 'Đăng Ký Sử Dụng Phòng Thực Hành';
    document.getElementById('bookingRoomSelect').value = appState.selectedRoomId;
    document.getElementById('bookingDaySelect').value = '4';
    document.getElementById('bookingSessionSelect').value = 'sang';
    document.getElementById('bookingPeriodSelect').value = '1';
    document.getElementById('bookingLessonInput').value = '';
    document.getElementById('bookingNoteInput').value = '';
    document.getElementById('bookingStatusStartInput').value = 'Máy móc hoạt động tốt, sạch sẽ';

    // BẢO VỆ RANH GIỚI: Giáo viên chỉ được đăng ký bằng tên và Gmail của chính mình!
    const u = appState.currentUser || {};
    document.getElementById('bookingTeacherNameInput').value = u.name || '';
    document.getElementById('bookingTeacherEmailLabel').textContent = u.email || '';

    document.getElementById('bookingConflictAlert').classList.add('hidden');
    modal.classList.remove('hidden');
  };

  window.quickOpenBooking = function (session, day, period) {
    openBookingModal();
    document.getElementById('bookingSessionSelect').value = session;
    document.getElementById('bookingDaySelect').value = day;
    document.getElementById('bookingPeriodSelect').value = period;
  };

  window.closeBookingModal = function () {
    document.getElementById('bookingModal')?.classList.add('hidden');
    closeWeekDropdowns();
  };

  function populateBookingFormOptions() {
    const roomSelect = document.getElementById('bookingRoomSelect');
    if (roomSelect) {
      roomSelect.innerHTML = appState.rooms.map(r => `<option value="${r.name}">${r.name} (${r.totalComputers || 0} máy)</option>`).join('');
    }

    const classSelect = document.getElementById('bookingClassSelect');
    if (classSelect) {
      classSelect.innerHTML = appState.classes.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    const subjSelect = document.getElementById('bookingSubjectSelect');
    if (subjSelect) {
      subjSelect.innerHTML = appState.subjects.map(s => `<option value="${s}">${s}</option>`).join('');
    }
  }

  window.handleBookingSubmit = function (e) {
    e.preventDefault();

    const bookingId = document.getElementById('bookingIdInput').value;
    const roomName = document.getElementById('bookingRoomSelect').value;
    const day = parseInt(document.getElementById('bookingDaySelect').value);
    const session = document.getElementById('bookingSessionSelect').value;
    const periodVal = document.getElementById('bookingPeriodSelect').value;
    const className = document.getElementById('bookingClassSelect').value;
    const subject = document.getElementById('bookingSubjectSelect').value;
    const lesson = document.getElementById('bookingLessonInput').value.trim();
    const statusStart = document.getElementById('bookingStatusStartInput').value.trim();
    const note = document.getElementById('bookingNoteInput').value.trim();

    const u = appState.currentUser || {};
    const weekNum = appState.selectedWeekNumber;

    // Kiểm tra khóa sổ: Giáo viên chỉ được sửa/xóa khi chưa khóa
    if (isWeekLocked(weekNum) && u.role !== 'admin') {
      alert(`Tuần ${weekNum} đã bị khóa sổ đăng ký. Bạn không thể thực hiện thao tác này!`);
      return;
    }

    const weekObj = appState.generatedWeeks.find(w => w.weekNumber === weekNum);
    const dInfo = weekObj?.dayDates[day];
    const dateLabel = dInfo ? `${DAY_NAMES[day]} ${dInfo.shortStr}` : DAY_NAMES[day];

    const periodsToBook = periodVal.includes(',')
      ? periodVal.split(',').map(Number)
      : [parseInt(periodVal)];

    // FIRST-COME, FIRST-SERVED: Kiểm tra trùng lịch
    for (let p of periodsToBook) {
      const conflict = appState.bookings.find(b =>
        b.id !== bookingId &&
        b.week === weekNum &&
        b.room === roomName &&
        b.session === session &&
        b.dayOfWeek === day &&
        b.period === p
      );

      if (conflict) {
        const conflictAlert = document.getElementById('bookingConflictAlert');
        const conflictMsg = document.getElementById('bookingConflictMsg');
        conflictMsg.textContent = `Tiết ${p} ${DAY_NAMES[day]} tại ${roomName} đã được ${conflict.teacherName} (${conflict.teacherEmail}) đăng ký trước cho lớp ${conflict.className}! Ai đăng ký trước giữ trước. Bạn không thể đăng ký đè. Vui lòng liên hệ ${conflict.teacherName} để nhờ nhường lịch hoặc báo Admin!`;
        conflictAlert.classList.remove('hidden');
        return;
      }
    }

    periodsToBook.forEach(p => {
      const newId = bookingId || `rec_${weekNum}_${session}_${day}_${p}_${Date.now()}`;
      const existingIdx = appState.bookings.findIndex(b => b.id === bookingId);

      const recordData = {
        id: newId,
        week: weekNum,
        session: session,
        dayOfWeek: day,
        dayName: DAY_NAMES[day],
        dateLabel: dateLabel,
        period: p,
        room: roomName,
        className: className,
        subject: subject,
        lesson: lesson,
        teacherName: u.name,
        teacherEmail: u.email,
        statusStart: statusStart || 'Máy móc hoạt động tốt',
        signStart: existingIdx >= 0 ? appState.bookings[existingIdx].signStart : '',
        signStartTime: existingIdx >= 0 ? appState.bookings[existingIdx].signStartTime : '',
        statusEnd: existingIdx >= 0 ? appState.bookings[existingIdx].statusEnd : '',
        signEnd: existingIdx >= 0 ? appState.bookings[existingIdx].signEnd : '',
        signEndTime: existingIdx >= 0 ? appState.bookings[existingIdx].signEndTime : '',
        note: note,
        isApproved: true
      };

      if (existingIdx >= 0) {
        // Chỉ chủ sở hữu hoặc admin mới được sửa
        if (appState.bookings[existingIdx].teacherEmail !== u.email && u.role !== 'admin') {
          alert('Bạn không thể chỉnh sửa tiết học của giáo viên khác!');
          return;
        }
        appState.bookings[existingIdx] = recordData;
      } else {
        appState.bookings.push(recordData);
      }
    });

    saveState();
    closeBookingModal();
    renderAll();

    if (typeof confetti === 'function') {
      confetti({ particleCount: 50, spread: 50 });
    }

    showToast('Đăng ký tiết thực hành thành công!');
  };

  // ================= CHI TIẾT & BẢO VỆ XÓA/SỬA =================
  window.openDetailModal = function (bookingId) {
    const booking = appState.bookings.find(b => b.id === bookingId);
    if (!booking) return;

    const content = document.getElementById('detailModalContent');
    if (!content) return;

    const u = appState.currentUser;
    const isMine = u?.email === booking.teacherEmail;
    const isAdmin = u?.role === 'admin';
    const locked = isWeekLocked(booking.week);

    content.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
            ${booking.room} • ${booking.session === 'sang' ? 'Buổi Sáng' : 'Buổi Chiều'}
          </span>
          <span class="text-xs font-bold text-slate-700 font-mono">
            ${booking.dayName} • Tiết ${booking.period}
          </span>
        </div>

        <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
          <p class="text-sm font-black text-slate-900">${booking.lesson || booking.subject}</p>
          <div class="flex items-center gap-2 mt-1 text-xs text-slate-600">
            <span class="font-bold text-brand-700">Lớp: ${booking.className}</span>
            <span>•</span>
            <span>Môn: ${booking.subject}</span>
          </div>
          <p class="text-xs text-slate-500 mt-1">
            Giáo viên phụ trách: <strong>${booking.teacherName}</strong> 
            <span class="font-mono text-slate-400">(${booking.teacherEmail})</span>
          </p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="p-3 bg-white rounded-xl border border-slate-200">
            <p class="font-bold text-slate-800 text-[11px] mb-1">Tình trạng đầu giờ:</p>
            <p class="text-slate-600 text-[11px]">${booking.statusStart || 'Chưa ghi nhận'}</p>
            <div class="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
              <span class="text-slate-400">GV ký:</span>
              <span class="font-bold text-emerald-700">${booking.signStart || 'Chưa ký'}</span>
            </div>
          </div>

          <div class="p-3 bg-white rounded-xl border border-slate-200">
            <p class="font-bold text-slate-800 text-[11px] mb-1">Tình trạng cuối giờ:</p>
            <p class="text-slate-600 text-[11px]">${booking.statusEnd || 'Chưa bàn giao'}</p>
            <div class="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
              <span class="text-slate-400">GV ký:</span>
              <span class="font-bold text-emerald-700">${booking.signEnd || 'Chưa ký'}</span>
            </div>
          </div>
        </div>

        ${booking.note ? `
          <div class="p-2.5 bg-amber-50/60 rounded-xl border border-amber-200 text-xs text-amber-800">
            <strong>Ghi chú:</strong> ${booking.note}
          </div>
        ` : ''}

        <!-- Actions -->
        <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-2">
            <!-- VIỆC KÝ KHI DẠY THÌ VẪN ĐƯỢC KỂ CẢ KHI SỔ ĐÃ KHÓA -->
            ${(isMine || isAdmin) && !booking.signStart ? `
              <button onclick="closeDetailModal(); openSignModal('${booking.id}', 'start')" class="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-xs">
                Ký nhận đầu giờ
              </button>
            ` : ''}

            ${(isMine || isAdmin) && booking.signStart && !booking.signEnd ? `
              <button onclick="closeDetailModal(); openSignModal('${booking.id}', 'end')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs">
                Ký bàn giao cuối giờ
              </button>
            ` : ''}
          </div>

          <div class="flex items-center gap-2">
            <!-- CHỈ ĐƯỢC XÓA CỦA MÌNH KHI CHƯA KHÓA, HOẶC ADMIN CÓ THỂ XÓA -->
            ${((isMine && !locked) || isAdmin) ? `
              <button onclick="deleteBooking('${booking.id}')" class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-lg text-xs border border-red-200">
                <i class="fa-solid fa-trash mr-1"></i> Hủy tiết này
              </button>
            ` : (isMine && locked ? '<span class="text-slate-400 text-[10px] italic">Sổ đã khóa, không thể hủy</span>' : '')}

            <button onclick="closeDetailModal()" class="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs">
              Đóng
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('detailModal')?.classList.remove('hidden');
  };

  window.closeDetailModal = function () {
    document.getElementById('detailModal')?.classList.add('hidden');
  };

  // "Tài khoản giáo viên chỉ đăng kí của mình và xóa của mình trong thời gian admin chưa khóa đăng kí thôi."
  window.deleteBooking = function (bookingId) {
    const booking = appState.bookings.find(b => b.id === bookingId);
    if (!booking) return;

    const u = appState.currentUser;
    const isMine = u?.email === booking.teacherEmail;
    const isAdmin = u?.role === 'admin';
    const locked = isWeekLocked(booking.week);

    if (!isAdmin) {
      if (!isMine) {
        alert('Bạn không thể xóa tiết học do giáo viên khác đăng ký!');
        return;
      }
      if (locked) {
        alert('Sổ đăng ký tuần này đã bị khóa! Vui lòng liên hệ Admin nếu cần hủy tiết này.');
        return;
      }
    }

    if (!confirm('Bạn có chắc chắn muốn hủy đăng ký tiết học này không?')) return;

    appState.bookings = appState.bookings.filter(b => b.id !== bookingId);
    saveState();
    closeDetailModal();
    renderAll();
    showToast('Đã hủy đăng ký tiết học thành công.');
  };

  // ================= KÝ NHẬN & BÀN GIAO =================
  window.openSignModal = function (bookingId, signType) {
    const booking = appState.bookings.find(b => b.id === bookingId);
    if (!booking) return;

    const u = appState.currentUser;
    if (u.role !== 'admin' && u.email !== booking.teacherEmail) {
      alert('Bạn chỉ có thể ký trên tiết học do chính mình giảng dạy!');
      return;
    }

    document.getElementById('signBookingId').value = bookingId;
    document.getElementById('signType').value = signType;
    document.getElementById('signInfoLesson').textContent = `${booking.lesson || booking.subject} - Lớp ${booking.className}`;
    document.getElementById('signInfoSlot').textContent = `${booking.room} • ${booking.dayName} (${booking.session === 'sang' ? 'Sáng' : 'Chiều'}) • Tiết ${booking.period}`;

    if (signType === 'start') {
      document.getElementById('signModalTitle').textContent = 'Ký Nhận Phòng Đầu Giờ';
      document.getElementById('signStatusInput').value = booking.statusStart || '36/36 máy hoạt động tốt, phòng sạch sẽ';
    } else {
      document.getElementById('signModalTitle').textContent = 'Ký Bàn Giao Phòng Cuối Giờ';
      document.getElementById('signStatusInput').value = booking.statusEnd || 'Đã ngắt điện, thiết bị nguyên vẹn';
    }

    document.getElementById('signSignatureInput').value = u.signature || u.name;
    document.getElementById('signModal')?.classList.remove('hidden');
  };

  window.closeSignModal = function () {
    document.getElementById('signModal')?.classList.add('hidden');
  };

  window.submitSignature = function () {
    const bookingId = document.getElementById('signBookingId').value;
    const signType = document.getElementById('signType').value;
    const statusVal = document.getElementById('signStatusInput').value.trim();
    const sigVal = document.getElementById('signSignatureInput').value.trim();

    if (!sigVal) {
      alert('Vui lòng nhập chữ ký xác nhận!');
      return;
    }

    const booking = appState.bookings.find(b => b.id === bookingId);
    if (!booking) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (signType === 'start') {
      booking.statusStart = statusVal;
      booking.signStart = sigVal;
      booking.signStartTime = timeStr;
    } else {
      booking.statusEnd = statusVal;
      booking.signEnd = sigVal;
    }

    saveState();
    closeSignModal();
    renderAll();
    showToast(signType === 'start' ? 'Đã ký nhận phòng đầu giờ!' : 'Đã ký bàn giao phòng cuối giờ!');
  };

  // ================= EXCEL EXPORT =================
  window.toggleExcelMenu = function () {
    document.getElementById('excelExportMenu')?.classList.toggle('hidden');
  };

  window.exportCurrentWeekToExcel = function () {
    document.getElementById('excelExportMenu')?.classList.add('hidden');
    if (typeof XLSX === 'undefined') return;

    const curWeek = appState.selectedWeekNumber;
    const curRoom = appState.rooms.find(r => r.id === appState.selectedRoomId) || appState.rooms[0];
    const weekObj = appState.generatedWeeks.find(w => w.weekNumber === curWeek);

    const wb = XLSX.utils.book_new();
    const ws = buildExcelSheetForWeek(curWeek, curRoom.name, weekObj);
    XLSX.utils.book_append_sheet(wb, ws, `Tuan_${curWeek}`);
    XLSX.writeFile(wb, `SO_THUC_HANH_TUAN_${curWeek}_${curRoom.name.replace(/\s+/g, '_')}.xlsx`);
    showToast(`Đã xuất file Excel Tuần ${curWeek}!`);
  };

  window.exportAllWeeksToExcel = function () {
    document.getElementById('excelExportMenu')?.classList.add('hidden');
    if (typeof XLSX === 'undefined') return;

    const curRoom = appState.rooms.find(r => r.id === appState.selectedRoomId) || appState.rooms[0];
    const wb = XLSX.utils.book_new();

    appState.generatedWeeks.forEach(w => {
      const ws = buildExcelSheetForWeek(w.weekNumber, curRoom.name, w);
      XLSX.utils.book_append_sheet(wb, ws, String(w.weekNumber));
    });

    XLSX.writeFile(wb, `SO_THUC_HANH_PHONG_MAY_2026_2027.xlsx`);
    showToast('Đã xuất toàn bộ 38 tuần ra file Excel đa sheet!');
  };

  function buildExcelSheetForWeek(weekNum, roomName, weekObj) {
    const rows = [];
    rows.push(['SỔ THỰC HÀNH PHÒNG MÁY TÍNH', '', '', '', '', '', '', '']);
    rows.push(['', 'Tuần', weekNum, 'Buổi:', '', 'Sáng', '', '']);
    rows.push(['', '', '', '', '', '', '', '']);
    rows.push(['Thứ/ Ngày', 'Tiết', 'Giáo viên dạy', 'Tình trạng đầu giờ', 'GV ký', 'Tình trạng cuối giờ', 'GV ký', 'Ghi chú']);

    for (let day = 2; day <= 7; day++) {
      const dInfo = weekObj?.dayDates[day];
      const dateLabel = dInfo ? `${DAY_NAMES[day]}\n${dInfo.shortStr}` : DAY_NAMES[day];

      for (let p = 1; p <= 5; p++) {
        const booking = appState.bookings.find(b =>
          b.week === weekNum &&
          b.room === roomName &&
          b.session === 'sang' &&
          b.dayOfWeek === day &&
          b.period === p
        );

        rows.push([
          p === 1 ? dateLabel : '',
          p,
          booking ? `${booking.teacherName} (${booking.className})` : '',
          booking ? (booking.statusStart || '') : '',
          booking ? (booking.signStart || '') : '',
          booking ? (booking.statusEnd || '') : '',
          booking ? (booking.signEnd || '') : '',
          booking ? (booking.note || '') : ''
        ]);
      }
    }

    rows.push(['SỔ THỰC HÀNH PHÒNG MÁY TÍNH', '', '', '', '', '', '', '']);
    rows.push(['', 'Tuần', weekNum, 'Buổi:', '', 'Chiều', '', '']);
    rows.push(['', '', '', '', '', '', '', '']);
    rows.push(['Thứ', 'Tiết', 'Giáo viên dạy', 'Tình trạng đầu giờ', 'GV ký', 'Tình trạng cuối giờ', 'GV ký', 'Ghi chú']);

    for (let day = 2; day <= 7; day++) {
      const dInfo = weekObj?.dayDates[day];
      const dateLabel = dInfo ? `${DAY_NAMES[day]}\n${dInfo.shortStr}` : DAY_NAMES[day];

      for (let p = 1; p <= 5; p++) {
        const booking = appState.bookings.find(b =>
          b.week === weekNum &&
          b.room === roomName &&
          b.session === 'chieu' &&
          b.dayOfWeek === day &&
          b.period === p
        );

        rows.push([
          p === 1 ? dateLabel : '',
          p,
          booking ? `${booking.teacherName} (${booking.className})` : '',
          booking ? (booking.statusStart || '') : '',
          booking ? (booking.signStart || '') : '',
          booking ? (booking.statusEnd || '') : '',
          booking ? (booking.signEnd || '') : '',
          booking ? (booking.note || '') : ''
        ]);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 14 }, { wch: 6 }, { wch: 22 }, { wch: 22 }, { wch: 12 }, { wch: 22 }, { wch: 12 }, { wch: 20 }];
    return ws;
  }

  // ================= PRINT =================
  window.printCurrentTimetable = function () {
    const curWeek = appState.selectedWeekNumber;
    const curRoom = appState.rooms.find(r => r.id === appState.selectedRoomId) || appState.rooms[0];
    const weekObj = appState.generatedWeeks.find(w => w.weekNumber === curWeek);

    document.getElementById('printMainTitle').textContent = `SỔ THỰC HÀNH PHÒNG MÁY TÍNH`;
    document.getElementById('printSubTitle').textContent = `NĂM HỌC 2026 - 2027 • TUẦN ${curWeek} (${weekObj?.dateRangeStr || ''})`;
    document.getElementById('printRoomInfo').textContent = `${curRoom.name} (${curRoom.totalComputers || 0} máy học sinh)`;

    document.getElementById('printWeekNumSang').textContent = `Tuần: ${curWeek}`;
    document.getElementById('printWeekNumChieu').textContent = `Tuần: ${curWeek}`;

    document.getElementById('printTableMorning').innerHTML = buildPrintTableHTML('sang', curWeek, curRoom.name, weekObj);
    document.getElementById('printTableAfternoon').innerHTML = buildPrintTableHTML('chieu', curWeek, curRoom.name, weekObj);

    setTimeout(() => {
      window.print();
    }, 150);
  };

  function buildPrintTableHTML(session, weekNum, roomName, weekObj) {
    let html = `
      <thead>
        <tr>
          <th style="width: 14%;">Thứ / Ngày</th>
          <th style="width: 6%;">Tiết</th>
          <th style="width: 20%;">Giáo viên dạy</th>
          <th style="width: 20%;">Tình trạng đầu giờ</th>
          <th style="width: 10%;">GV ký</th>
          <th style="width: 20%;">Tình trạng cuối giờ</th>
          <th style="width: 10%;">GV ký</th>
          <th style="width: 15%;">Ghi chú</th>
        </tr>
      </thead>
      <tbody>
    `;

    for (let day = 2; day <= 7; day++) {
      const dInfo = weekObj?.dayDates[day];
      const dateLabel = dInfo ? `${DAY_NAMES[day]}<br>${dInfo.shortStr}` : DAY_NAMES[day];

      for (let p = 1; p <= 5; p++) {
        const booking = appState.bookings.find(b =>
          b.week === weekNum &&
          b.room === roomName &&
          b.session === session &&
          b.dayOfWeek === day &&
          b.period === p
        );

        html += `<tr>`;
        if (p === 1) html += `<td rowspan="5" style="font-weight: bold; background: #fafafa;">${dateLabel}</td>`;
        html += `
          <td style="font-weight: bold;">${p}</td>
          <td>${booking ? `${booking.teacherName}<br><span style="font-size: 7.5pt; color: #555;">${booking.className}</span>` : ''}</td>
          <td>${booking ? (booking.statusStart || 'Bình thường') : ''}</td>
          <td>${booking && booking.signStart ? booking.signStart : ''}</td>
          <td>${booking ? (booking.statusEnd || '') : ''}</td>
          <td>${booking && booking.signEnd ? booking.signEnd : ''}</td>
          <td>${booking ? (booking.note || '') : ''}</td>
        </tr>`;
      }
    }

    html += `</tbody>`;
    return html;
  }

  // ================= AUTHENTICATION (BẢO MẬT GMAIL) =================
  window.openLoginModal = function () {
    document.getElementById('userMenuDropdown')?.classList.add('hidden');
    document.getElementById('loginModal')?.classList.remove('hidden');
  };

  window.closeLoginModal = function () {
    document.getElementById('loginModal')?.classList.add('hidden');
  };

  window.handleCustomGmailLogin = function () {
    const email = document.getElementById('customGmailInput').value.trim().toLowerCase();
    const name = document.getElementById('customNameInput').value.trim();

    if (!email || !email.includes('@')) {
      alert('Vui lòng nhập đúng định dạng Gmail!');
      return;
    }

    let u = appState.users.find(x => x.email === email);
    if (u) {
      if (name) u.name = name;
    } else {
      // Người dùng mới đăng nhập mặc định là Giáo viên!
      // KHÔNG AI CÓ THỂ TỰ PHONG ADMIN CHO CHÍNH MÌNH KHI ĐĂNG NHẬP
      u = {
        email: email,
        name: name || email.split('@')[0],
        role: 'teacher',
        department: 'Giáo viên bộ môn',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
        signature: name || email.split('@')[0]
      };
      appState.users.push(u);
    }

    appState.currentUser = u;
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(u));
    saveState();
    closeLoginModal();

    if (u.role !== 'admin' && appState.activeView === 'admin') {
      switchView('today');
    }

    renderAll();
    showToast(`Đăng nhập thành công với Gmail: ${email} (${u.role === 'admin' ? 'Admin' : 'Giáo viên'})`);
  };

  window.logoutCurrentUser = function () {
    // Đăng xuất -> chuyển về tài khoản giáo viên khách hoặc admin nếu cần
    localStorage.removeItem(CURRENT_USER_KEY);
    // Gán tài khoản mặc định
    appState.currentUser = appState.users[0] || {
      email: 'admin@gmail.com',
      name: 'Quản Trị Viên',
      role: 'admin'
    };
    document.getElementById('userMenuDropdown')?.classList.add('hidden');
    renderAll();
    showToast('Đã đăng xuất tài khoản.');
  };

  // ================= TOAST =================
  function showToast(msg) {
    let toast = document.getElementById('globalToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'globalToast';
      toast.className = 'fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-2 transform transition-all duration-300 translate-y-12 opacity-0 pointer-events-none';
      document.body.appendChild(toast);
    }

    toast.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400"></i> <span>${msg}</span>`;
    toast.classList.remove('translate-y-12', 'opacity-0', 'pointer-events-none');

    setTimeout(() => {
      toast.classList.add('translate-y-12', 'opacity-0', 'pointer-events-none');
    }, 3500);
  }

  // ================= GLOBAL CLICK LISTENERS =================
  function setupGlobalClickListeners() {
    const userBtn = document.getElementById('userMenuBtn');
    const userMenu = document.getElementById('userMenuDropdown');
    if (userBtn && userMenu) {
      userBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        userMenu.classList.toggle('hidden');
      });
    }

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#weekDropdownWrapper')) {
        document.getElementById('weekDropdownMenu')?.classList.add('hidden');
      }
      if (!e.target.closest('#modalWeekDropdownWrapper')) {
        document.getElementById('modalWeekDropdownMenu')?.classList.add('hidden');
      }
      if (!e.target.closest('#excelExportBtn') && !e.target.closest('#excelExportMenu')) {
        document.getElementById('excelExportMenu')?.classList.add('hidden');
      }
      if (!e.target.closest('#userMenuBtn') && !e.target.closest('#userMenuDropdown')) {
        document.getElementById('userMenuDropdown')?.classList.add('hidden');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeRoomModal();
        closeUserModal();
        closeImportUsersModal();
        closeBookingModal();
        closeBaoGiangModal();
        closeSignModal();
        closeDetailModal();
        closeLoginModal();
        closeAllPopups();
      }
    });
  }

  function closeAllPopups() {
    document.getElementById('weekDropdownMenu')?.classList.add('hidden');
    document.getElementById('modalWeekDropdownMenu')?.classList.add('hidden');
    document.getElementById('excelExportMenu')?.classList.add('hidden');
    document.getElementById('userMenuDropdown')?.classList.add('hidden');
  }

})();
