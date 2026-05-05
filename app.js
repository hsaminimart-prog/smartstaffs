/* ===================================================
   StaffSync — Application Logic (Supabase Backend)
   =================================================== */

(function () {
    'use strict';

    // ─── Supabase Client ────────────────────────────────
    const SUPABASE_URL = 'https://dkroffwlvegsrkjowljb.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_SZJEfW2zbYx4kiLwyqxdKg_VNONEVwA';
    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // ─── Helpers ────────────────────────────────────────
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    // ─── Session (localStorage for current user ID) ─────
    function setSession(user) { localStorage.setItem('ss_session', JSON.stringify(user)); }
    function getSession() { try { return JSON.parse(localStorage.getItem('ss_session')); } catch { return null; } }
    function clearSession() { localStorage.removeItem('ss_session'); }

    // ─── Toast ──────────────────────────────────────────
    let toastTimer;
    function toast(msg, type = 'success') {
        const el = $('#toast');
        el.textContent = msg;
        el.className = 'toast ' + type;
        clearTimeout(toastTimer);
        requestAnimationFrame(() => el.classList.add('show'));
        toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
    }

    // ─── View Router ────────────────────────────────────
    function showView(id) {
        $$('section').forEach(s => s.classList.remove('active'));
        const target = $('#' + id);
        if (target) target.classList.add('active');
    }

    // ─── Tab Router ─────────────────────────────────────
    function initTabs(section) {
        const links = section.querySelectorAll('.nav-link[data-tab]');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = link.dataset.tab;
                links.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                section.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
                const targetTab = section.querySelector('#tab-' + tab);
                if (targetTab) targetTab.classList.add('active');

                const titleEl = section.querySelector('.dashboard-header h2');
                if (titleEl) {
                    if (tab.includes('notifications')) {
                        titleEl.textContent = 'Notifications';
                    } else {
                        const cleanText = link.textContent.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2580-\u27BF]|\uD83E[\uDD10-\uDDFF]/g, '').trim();
                        titleEl.textContent = cleanText || 'Dashboard';
                    }
                }

                // Close dropdown immediately after routing
                document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('active'));
            });
        });
    }

    // ─── Live Clock ─────────────────────────────────────
    function startLiveClock() {
        function tick() {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            const clockEl = $('#live-clock');
            const dateEl = $('#live-date');
            if (clockEl) clockEl.textContent = timeStr;
            if (dateEl) dateEl.textContent = dateStr;
        }
        tick();
        setInterval(tick, 1000);
    }

    // ─── Format helpers ─────────────────────────────────
    function formatHours(ms) {
        if (!ms || ms < 0) return '0h 0m';
        const totalMin = Math.floor(ms / 60000);
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        return `${h}h ${m}m`;
    }

    function formatTime(iso) {
        if (!iso) return '—';
        return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }

    // ─── Avatar Helpers ─────────────────────────────────
    function setAvatar(selector, user) {
        const el = $(selector);
        if (!el) return;
        if (user.profile_image) {
            el.innerHTML = `<img src="${user.profile_image}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
            el.textContent = user.name.charAt(0).toUpperCase();
        }
    }

    function setAvatarLarge(selector, user) {
        const el = $(selector);
        if (!el) return;
        if (user.profile_image) {
            el.innerHTML = `<img src="${user.profile_image}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
            el.textContent = user.name.charAt(0).toUpperCase();
        }
    }

    async function handleProfileUpload(e, user, sidebarSel, largeSel) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            // Compress via canvas
            const img = new Image();
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                const MAX = 200;
                const ratio = Math.min(MAX / img.width, MAX / img.height);
                canvas.width = img.width * ratio;
                canvas.height = img.height * ratio;
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                const compressed = canvas.toDataURL('image/jpeg', 0.75);
                // Save to DB
                const { error } = await sb.from('users').update({ profile_image: compressed }).eq('id', user.id);
                if (error) { toast('Upload failed', 'error'); return; }
                user.profile_image = compressed;
                const session = getSession();
                if (session) { session.profile_image = compressed; setSession(session); }
                // Update UI
                const sidebarEl = $(sidebarSel);
                if (sidebarEl) sidebarEl.innerHTML = `<img src="${compressed}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                const largeEl = $(largeSel);
                if (largeEl) largeEl.innerHTML = `<img src="${compressed}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                toast('Profile picture updated! 🎉');
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    }

    function formatCurrency(val) {
        return '£' + Number(val).toFixed(2);
    }

    function formatDate(iso) {
        if (!iso) return '—';
        return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }

    function generateCompanyCode(name) {
        const prefix = name.replace(/[^A-Z]/gi, '').slice(0, 4).toUpperCase() || 'COMP';
        const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
        return prefix + '-' + rand;
    }

    // ─── Date range helpers ─────────────────────────────
    function startOfDay(d) {
        const r = new Date(d); r.setHours(0, 0, 0, 0); return r;
    }
    function startOfWeek(d) {
        const r = new Date(d);
        const day = r.getDay();
        const diff = day === 0 ? 6 : day - 1;
        r.setDate(r.getDate() - diff);
        r.setHours(0, 0, 0, 0);
        return r;
    }
    function startOfMonth(d) {
        const r = new Date(d); r.setDate(1); r.setHours(0, 0, 0, 0); return r;
    }

    function totalHoursInPeriod(entries, userId, periodStart) {
        if (!entries || entries.length === 0) return 0;
        let totalMs = 0;
        const now = new Date();
        entries.forEach(e => {
            if (e.user_id !== userId) return;
            const entryStart = new Date(e.clock_in);
            if (entryStart < periodStart) return;
            let entryOut;
            if (!e.clock_out) {
                entryOut = now; // Add actively running session duration dynamically
            } else {
                entryOut = new Date(e.clock_out);
            }
            totalMs += (entryOut - entryStart);
        });
        return totalMs;
    }



    // ─────────────────────────────────────────────────────
    // AUTH: Sign Up
    // ─────────────────────────────────────────────────────
    $('#form-signup').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = $('#signup-name').value.trim();
        const email = $('#signup-email').value.trim().toLowerCase();
        const password = $('#signup-password').value;

        // Check if user exists
        const { data: existing } = await sb.from('users').select('id').eq('email', email).maybeSingle();
        if (existing) {
            toast('Account already exists. Please sign in.', 'error');
            return;
        }

        const { data: user, error } = await sb.from('users').insert({
            name,
            email,
            password_hash: password,
            role: null,
            company_id: null,
            status: null,
            total_points: 0,
        }).select().single();

        if (error) {
            toast('Signup failed: ' + error.message, 'error');
            return;
        }

        setSession(user);
        toast('Account created! 🎉');
        showView('view-choose-role');
        $('#form-signup').reset();
    });

    // ─────────────────────────────────────────────────────
    // AUTH: Login
    // ─────────────────────────────────────────────────────
    $('#form-login').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = $('#login-email').value.trim().toLowerCase();
        const password = $('#login-password').value;

        const { data: user, error } = await sb
            .from('users')
            .select('*')
            .eq('email', email)
            .eq('password_hash', password)
            .maybeSingle();

        if (!user) {
            toast('Invalid credentials', 'error');
            return;
        }

        setSession(user);
        await routeAfterLogin(user);
        $('#form-login').reset();
    });

    async function routeAfterLogin(user) {
        if (typeof renderNotifications === 'function') {
            renderNotifications();
        }

        if (user.role === 'super_admin') {
            await enterSuperAdminDashboard();
        } else if (user.role === 'owner') {
            if (user.owner_approved) {
                await enterOwnerDashboard(user);
            } else {
                showView('view-owner-waiting');
            }
        } else if (user.role === 'staff') {
            const { data: req } = await sb
                .from('join_requests')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();

            if (!req) {
                showView('view-choose-role');
            } else if (req.status === 'APPROVED') {
                await enterStaffDashboard(user);
            } else if (req.status === 'REJECTED') {
                showView('view-rejected');
            } else {
                showView('view-waiting');
            }
        } else {
            showView('view-choose-role');
        }
    }

    // ─────────────────────────────────────────────────────
    // Navigation links
    // ─────────────────────────────────────────────────────
    $('#goto-signup').addEventListener('click', (e) => { e.preventDefault(); showView('view-signup'); });
    $('#goto-login').addEventListener('click', (e) => { e.preventDefault(); showView('view-login'); });
    $('#btn-create-company').addEventListener('click', () => showView('view-create-company'));
    $('#btn-join-company').addEventListener('click', () => showView('view-join-company'));
    $('#back-to-role-from-create').addEventListener('click', (e) => { e.preventDefault(); showView('view-choose-role'); });
    $('#back-to-role-from-join').addEventListener('click', (e) => { e.preventDefault(); showView('view-choose-role'); });

    // Logout
    function logout() { clearSession(); showView('view-login'); toast('Signed out'); }
    if ($('#btn-logout-owner')) $('#btn-logout-owner').addEventListener('click', logout);
    if ($('#btn-logout-owner-mobile')) $('#btn-logout-owner-mobile').addEventListener('click', logout);
    if ($('#btn-logout-staff')) $('#btn-logout-staff').addEventListener('click', logout);
    if ($('#btn-logout-staff-mobile')) $('#btn-logout-staff-mobile').addEventListener('click', logout);
    if ($('#btn-logout-owner-dropdown')) $('#btn-logout-owner-dropdown').addEventListener('click', logout);
    if ($('#btn-logout-staff-dropdown')) $('#btn-logout-staff-dropdown').addEventListener('click', logout);
    if ($('#btn-logout-waiting')) $('#btn-logout-waiting').addEventListener('click', (e) => { e.preventDefault(); logout(); });
    if ($('#btn-logout-owner-waiting')) $('#btn-logout-owner-waiting').addEventListener('click', (e) => { e.preventDefault(); logout(); });
    if ($('#btn-logout-admin')) $('#btn-logout-admin').addEventListener('click', logout);
    if ($('#btn-logout-admin-mobile')) $('#btn-logout-admin-mobile').addEventListener('click', logout);
    if ($('#btn-logout-rejected')) $('#btn-logout-rejected').addEventListener('click', logout);

    // Top Hamburger Menu Logic
    function toggleDropdown(btnId, dropdownId) {
        const btn = $(`#${btnId}`);
        const menu = $(`#${dropdownId}`);
        if (btn && menu) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // prevent window click from immediately closing it
                menu.classList.toggle('active');
            });
        }
    }

    toggleDropdown('btn-owner-hamburger', 'dropdown-owner');
    toggleDropdown('btn-staff-hamburger', 'dropdown-staff');

    // Close dropdowns if clicking anywhere else
    window.addEventListener('click', (e) => {
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            if (menu.classList.contains('active') && !menu.contains(e.target)) {
                menu.classList.remove('active');
            }
        });
    });

    // Refresh status
    $('#btn-refresh-owner-status').addEventListener('click', async () => {
        const session = getSession();
        if (!session) return;
        const { data: freshUser } = await sb.from('users').select('*').eq('id', session.id).single();
        if (freshUser) {
            setSession(freshUser);
            if (freshUser.owner_approved) {
                toast('Approved! Entering dashboard...');
                await enterOwnerDashboard(freshUser);
            } else {
                toast('Still waiting for Super Admin approval...');
            }
        }
    });

    $('#btn-refresh-status').addEventListener('click', async () => {
        const session = getSession();
        if (!session) return;

        const { data: req } = await sb
            .from('join_requests')
            .select('*')
            .eq('user_id', session.id)
            .maybeSingle();

        if (!req) return;

        if (req.status === 'APPROVED') {
            const { data: freshUser } = await sb.from('users').select('*').eq('id', session.id).single();
            setSession(freshUser);
            await enterStaffDashboard(freshUser);
            toast('You have been approved! 🎉');
        } else if (req.status === 'REJECTED') {
            showView('view-rejected');
        } else {
            toast('Still waiting for approval…');
        }
    });

    // ─── Reusable Compressor ─────────────────────────────────
    function compressImageAsync(file, maxDimension = 600) {
        return new Promise((resolve, reject) => {
            if (!file) return resolve(null);
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ratio = Math.min(maxDimension / img.width, maxDimension / img.height, 1);
                    canvas.width = img.width * ratio;
                    canvas.height = img.height * ratio;
                    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.onerror = reject;
                img.src = ev.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // ─────────────────────────────────────────────────────
    // CREATE COMPANY
    // ─────────────────────────────────────────────────────
    $('#form-create-company').addEventListener('submit', async (e) => {
        e.preventDefault();
        const session = getSession();
        if (!session) return;

        const name = $('#company-name').value.trim();
        const hourlyRate = parseFloat($('#company-hourly-rate').value) || 0;
        const code = generateCompanyCode(name);

        // Grab proofs
        const paymentFile = $('#company-payment-proof').files[0];
        const businessFile = $('#company-business-proof').files[0];

        if (!paymentFile || !businessFile) {
            toast('Please upload both required proof images.', 'error');
            return;
        }

        toast('Encrypting and uploading proofs... ⏳');

        let payment_proof = null;
        let business_proof = null;
        try {
            payment_proof = await compressImageAsync(paymentFile, 800);
            business_proof = await compressImageAsync(businessFile, 800);
        } catch (err) {
            toast('Failed to process images.', 'error');
            return;
        }

        const { data: company, error } = await sb.from('companies').insert({
            name,
            code,
            owner_id: session.id,
            hourly_rate: hourlyRate,
            payment_proof,
            business_proof
        }).select().single();

        if (error) {
            toast('Failed to create company: ' + error.message, 'error');
            return;
        }

        await sb.from('users').update({
            role: 'owner',
            company_id: company.id,
            status: 'PENDING'
        }).eq('id', session.id);

        const { data: freshUser } = await sb.from('users').select('*').eq('id', session.id).single();
        setSession(freshUser);

        toast(`Company registered! Awaiting Super Admin approval.`);
        $('#form-create-company').reset();
        showView('view-owner-waiting');
    });

    // ─────────────────────────────────────────────────────
    // JOIN COMPANY
    // ─────────────────────────────────────────────────────
    $('#form-join-company').addEventListener('submit', async (e) => {
        e.preventDefault();
        const session = getSession();
        if (!session) return;

        const code = $('#join-code').value.trim().toUpperCase();

        const { data: company } = await sb
            .from('companies')
            .select('*')
            .eq('code', code)
            .maybeSingle();

        if (!company) {
            toast('Company not found. Check the code.', 'error');
            return;
        }

        // Check if already requested
        const { data: existing } = await sb
            .from('join_requests')
            .select('id')
            .eq('user_id', session.id)
            .maybeSingle();

        if (existing) {
            toast('You already have a join request.', 'error');
            return;
        }

        await sb.from('join_requests').insert({
            user_id: session.id,
            company_id: company.id,
            status: 'PENDING',
        });

        await sb.from('users').update({
            role: 'staff',
            company_id: company.id,
            status: 'PENDING'
        }).eq('id', session.id);

        const { data: freshUser } = await sb.from('users').select('*').eq('id', session.id).single();
        setSession(freshUser);

        toast('Join request sent! ⏳');
        $('#form-join-company').reset();
        showView('view-waiting');
    });

    // ─────────────────────────────────────────────────────
    // OWNER DASHBOARD
    // ─────────────────────────────────────────────────────
    async function enterOwnerDashboard(user) {
        showView('view-owner-dashboard');

        const { data: company } = await sb.from('companies').select('*').eq('id', user.company_id).single();
        if (!company) return;

        $('#owner-name').textContent = user.name;
        setAvatar('#owner-avatar', user);
        $('#display-company-code').textContent = company.code;

        // Profile tab
        $('#owner-profile-name').textContent = user.name;
        $('#owner-profile-email').textContent = user.email;
        setAvatarLarge('#owner-profile-avatar-preview', user);

        // Settings
        $('#setting-company-name').value = company.name;
        $('#setting-hourly-rate').value = company.hourly_rate;

        initTabs($('#view-owner-dashboard'));

        // Open on Attendance tab by default
        const attLink = $('#view-owner-dashboard').querySelector('.nav-link[data-tab="owner-attendance"]');
        if (attLink) attLink.click();

        await renderJoinRequests(company);
        await renderStaffList(company);
        await renderSalaryReport(company);
        await renderOwnerTasks(company);
        await renderOwnerSubmissions(company);
        await renderOwnerAttendance(company);
        await renderBranchesSettings(company);
        await renderOwnerQRCodes(company);

        // Listeners
        $('#salary-date-from').onchange = () => renderSalaryReport(company);
        $('#salary-date-to').onchange = () => renderSalaryReport(company);
        $('#salary-staff-filter').onchange = () => renderSalaryReport(company);
        $('#attendance-period').onchange = () => renderOwnerAttendance(company);
        $('#attendance-branch-filter').onchange = () => renderOwnerAttendance(company);

        // Profile upload
        $('#owner-profile-upload').onchange = (e) => handleProfileUpload(e, user, '#owner-avatar', '#owner-profile-avatar-preview');
        $('#btn-owner-profile-logout').onclick = logout;
        $('#btn-owner-switch-account').onclick = logout;

        // Attendance: toggle custom range inputs
        $('#attendance-period').addEventListener('change', () => {
            const isCustom = $('#attendance-period').value === 'custom';
            const rangeDiv = $('#attendance-custom-range');
            if (rangeDiv) rangeDiv.style.display = isCustom ? 'flex' : 'none';
            renderOwnerAttendance(company);
        });
        $('#attendance-date-from').addEventListener('change', () => renderOwnerAttendance(company));
        $('#attendance-date-to').addEventListener('change',   () => renderOwnerAttendance(company));

        // Staff attendance detail modal close buttons
        $('#btn-close-staff-detail').onclick = () => $('#modal-staff-attendance-detail').classList.remove('open');
        $('#btn-close-staff-detail-footer').onclick = () => $('#modal-staff-attendance-detail').classList.remove('open');
        $('#modal-staff-attendance-detail').addEventListener('click', (ev) => {
            if (ev.target === $('#modal-staff-attendance-detail')) $('#modal-staff-attendance-detail').classList.remove('open');
        });
    }

    // ── Join Requests ───────────────────────────────────
    async function renderJoinRequests(company) {
        const container = $('#requests-container');

        const { data: requests } = await sb
            .from('join_requests')
            .select('*, users!inner(name, email)')
            .eq('company_id', company.id)
            .eq('status', 'PENDING');

        if (!requests || requests.length === 0) {
            container.innerHTML = '<p class="empty-state">No pending requests 🎉</p>';
            return;
        }

        container.innerHTML = requests.map(req => {
            const user = req.users;
            return `
        <div class="request-item" data-request-id="${req.id}">
          <div class="request-info">
            <h4>${user.name}</h4>
            <p>${user.email}</p>
          </div>
          <div class="request-actions">
            <button class="btn btn-approve" onclick="window.approveRequest('${req.id}', '${req.user_id}')">✅ Approve</button>
            <button class="btn btn-reject" onclick="window.rejectRequest('${req.id}', '${req.user_id}')">❌ Reject</button>
          </div>
        </div>`;
        }).join('');
    }

    window.approveRequest = async function (reqId, userId) {
        await sb.from('join_requests').update({ status: 'APPROVED' }).eq('id', reqId);
        await sb.from('users').update({ status: 'APPROVED' }).eq('id', userId);
        toast('Staff approved ✅');

        const session = getSession();
        const { data: company } = await sb.from('companies').select('*').eq('id', session.company_id).single();
        await renderJoinRequests(company);
        await renderStaffList(company);
    };

    window.rejectRequest = async function (reqId, userId) {
        await sb.from('join_requests').update({ status: 'REJECTED' }).eq('id', reqId);
        await sb.from('users').update({ status: 'REJECTED' }).eq('id', userId);
        toast('Staff rejected ❌');

        const session = getSession();
        const { data: company } = await sb.from('companies').select('*').eq('id', session.company_id).single();
        await renderJoinRequests(company);
    };

    // ── Staff List ──────────────────────────────────────
    async function renderStaffList(company) {
        const container = $('#staff-list-container');

        const { data: requests } = await sb
            .from('join_requests')
            .select('*, users!inner(id, name, email, total_points)')
            .eq('company_id', company.id)
            .eq('status', 'APPROVED');

        if (!requests || requests.length === 0) {
            container.innerHTML = '<p class="empty-state">No approved staff yet</p>';
            return;
        }

        // Check who is clocked in
        const { data: activeEntries } = await sb
            .from('time_entries')
            .select('user_id')
            .eq('company_id', company.id)
            .is('clock_out', null);

        const activeUserIds = new Set((activeEntries || []).map(e => e.user_id));

        container.innerHTML = requests.map(req => {
            const user = req.users;
            const isActive = activeUserIds.has(user.id);
            const badge = isActive
                ? '<span class="staff-badge online">🟢 Clocked In</span>'
                : '<span class="staff-badge offline">Offline</span>';
            const points = user.total_points || 0;
            return `
        <div class="staff-item">
          <div class="staff-details">
            <div class="avatar">${user.name.charAt(0).toUpperCase()}</div>
            <div>
              <div class="user-name">${user.name}</div>
              <div class="user-role">${user.email} · 🎯 <span id="display-points-${user.id}">${points}</span> pts</div>
              <div class="edit-points-container" id="edit-points-${user.id}" style="display:none;">
                <input type="number" class="edit-points-input" id="input-points-${user.id}" value="${points}">
                <button class="btn btn-save-sm" onclick="window.savePoints('${user.id}')">Save</button>
                <button class="btn btn-cancel-sm" onclick="window.togglePointsEdit('${user.id}')">✕</button>
              </div>
            </div>
          </div>
          <div style="text-align: right;">
            ${badge}
            <div style="margin-top: 8px;">
              <a href="#" onclick="window.togglePointsEdit('${user.id}'); return false;" style="font-size: 12px; color: var(--accent-light);">Edit Points</a>
            </div>
          </div>
        </div>`;
        }).join('');
    }

    window.togglePointsEdit = function (userId) {
        const editContainer = $('#edit-points-' + userId);
        if (editContainer) {
            if (editContainer.style.display === 'none') {
                editContainer.style.display = 'flex';
            } else {
                editContainer.style.display = 'none';
            }
        }
    };

    window.savePoints = async function (userId) {
        const input = $('#input-points-' + userId);
        if (!input) return;
        const newPoints = parseInt(input.value) || 0;

        const { error } = await sb.from('users').update({ total_points: newPoints }).eq('id', userId);
        if (error) {
            toast('Failed to update points', 'error');
            return;
        }

        toast('Points updated! \ud83c\udfaf');
        const session = getSession();
        const { data: company } = await sb.from('companies').select('*').eq('id', session.company_id).single();
        await renderStaffList(company);
    };

    // ── Salary Report ───────────────────────────────────
    async function renderSalaryReport(company) {
        const container = $('#salary-report-container');
        const dateFromInput = $('#salary-date-from');
        const dateToInput = $('#salary-date-to');
        const staffFilter = $('#salary-staff-filter');

        // Set default dates if empty
        if (!dateFromInput.value) {
            dateFromInput.value = new Date().toISOString().split('T')[0];
        }
        if (!dateToInput.value) {
            dateToInput.value = new Date().toISOString().split('T')[0];
        }

        const targetDateFromStr = dateFromInput.value; // YYYY-MM-DD
        const targetDateToStr = dateToInput.value;     // YYYY-MM-DD
        const selectedUserId = staffFilter.value;

        const { data: approvedRequests } = await sb
            .from('join_requests')
            .select('*, users!inner(id, name)')
            .eq('company_id', company.id)
            .eq('status', 'APPROVED');

        if (!approvedRequests || approvedRequests.length === 0) {
            container.innerHTML = '<p class="empty-state">No staff data yet</p>';
            return;
        }

        // Populate the dropdown if it's currently only containing "All Staff" and we have staff
        if (staffFilter.options.length <= 1) {
            approvedRequests.forEach(req => {
                const opt = document.createElement('option');
                opt.value = req.users.id;
                opt.textContent = req.users.name;
                staffFilter.appendChild(opt);
            });
            // Restore the selected value just in case
            staffFilter.value = selectedUserId || 'all';
        }

        // Parse the date range bounds
        const startObj = new Date(targetDateFromStr);
        startObj.setHours(0, 0, 0, 0);
        const endObj = new Date(targetDateToStr);
        endObj.setHours(23, 59, 59, 999);

        // Get all time entries for this specific date range
        const { data: entries } = await sb
            .from('time_entries')
            .select('*')
            .eq('company_id', company.id)
            .gte('clock_in', startObj.toISOString())
            .lte('clock_in', endObj.toISOString())
            .not('clock_out', 'is', null);

        let html = `
      <div class="salary-row header">
        <div>Staff</div>
        <div>Hours</div>
        <div>Rate</div>
        <div>Earnings</div>
      </div>`;

        let totalEarnings = 0;

        // Filter the staff loop based on selected dropdown
        const staffToRender = selectedUserId === 'all'
            ? approvedRequests
            : approvedRequests.filter(req => req.users.id === selectedUserId);

        if (staffToRender.length === 0) {
            container.innerHTML = '<p class="empty-state">No staff matched.</p>';
            return;
        }

        staffToRender.forEach(req => {
            const user = req.users;
            const userEntries = (entries || []).filter(e => e.user_id === user.id);
            const ms = userEntries.reduce((sum, e) => sum + (new Date(e.clock_out) - new Date(e.clock_in)), 0);
            const hours = ms / 3600000;
            const earnings = hours * Number(company.hourly_rate);
            totalEarnings += earnings;

            // Encode context for the click handler
            const ctx = encodeURIComponent(JSON.stringify({
                userId: user.id,
                userName: user.name,
                dateFrom: targetDateFromStr,
                dateTo: targetDateToStr,
                rate: company.hourly_rate
            }));

            html += `
        <div class="salary-row" style="cursor:pointer; transition:background 0.15s;" onmouseenter="this.style.background='rgba(255,255,255,0.04)'" onmouseleave="this.style.background=''" onclick="window.showStaffAttendanceDetail('${ctx}')">
          <div style="color:var(--accent-light); font-weight:600;">${user.name} <span style="font-size:11px; color:var(--text-muted); font-weight:400;">▶ details</span></div>
          <div>${formatHours(ms)}</div>
          <div>${formatCurrency(company.hourly_rate)}/hr</div>
          <div class="salary-amount">${formatCurrency(earnings)}</div>
        </div>`;
        });

        html += `
      <div class="salary-row" style="border-top: 2px solid var(--border-glass); margin-top: 8px; padding-top: 16px; font-weight: 700;">
        <div>Total</div>
        <div></div>
        <div></div>
        <div class="salary-amount">${formatCurrency(totalEarnings)}</div>
      </div>`;

        container.innerHTML = html;
    }

    // ── Staff Attendance Detail (from Salary) ────────────
    window.showStaffAttendanceDetail = async function (encodedCtx) {
        const ctx = JSON.parse(decodeURIComponent(encodedCtx));
        const { userId, userName, dateFrom, dateTo, rate } = ctx;

        const modal = $('#modal-staff-attendance-detail');
        const titleEl = $('#modal-staff-detail-title');
        const listEl  = $('#modal-staff-detail-list');
        const hoursEl = $('#modal-detail-hours');
        const payEl   = $('#modal-detail-pay');
        const sessEl  = $('#modal-detail-sessions');

        titleEl.textContent = `📋 ${userName} — Attendance`;
        listEl.innerHTML = '<p class="empty-state" style="padding:20px 0;">Loading…</p>';
        modal.classList.add('open');

        const startObj = new Date(dateFrom); startObj.setHours(0, 0, 0, 0);
        const endObj   = new Date(dateTo);   endObj.setHours(23, 59, 59, 999);

        const { data: entries } = await sb
            .from('time_entries')
            .select('*')
            .eq('user_id', userId)
            .gte('clock_in', startObj.toISOString())
            .lte('clock_in', endObj.toISOString())
            .not('clock_out', 'is', null)
            .order('clock_in', { ascending: false });

        const totalMs = (entries || []).reduce((sum, e) => sum + (new Date(e.clock_out) - new Date(e.clock_in)), 0);
        const totalPay = (totalMs / 3600000) * Number(rate);

        hoursEl.textContent = formatHours(totalMs);
        payEl.textContent   = formatCurrency(totalPay);
        sessEl.textContent  = (entries || []).length;

        if (!entries || entries.length === 0) {
            listEl.innerHTML = '<p class="empty-state" style="padding:20px 0;">No sessions in this date range</p>';
            return;
        }

        listEl.innerHTML = `
          <table class="attendance-table" style="margin-top:8px;">
            <thead>
              <tr>
                <th>Date</th>
                <th>Branch</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Duration</th>
                <th>Pay</th>
              </tr>
            </thead>
            <tbody>
              ${entries.map(e => {
                const dur = new Date(e.clock_out) - new Date(e.clock_in);
                const pay = (dur / 3600000) * Number(rate);
                const dateStr = new Date(e.clock_in).toLocaleDateString('en-GB', { day:'numeric', month:'short' });
                const bBadge = e.branch ? `<span class="branch-badge">${e.branch}</span>` : '—';
                const autoBadge = e.auto_clocked_out ? ' <span class="auto-badge" title="Auto clocked out">⚠️</span>' : '';
                return `<tr>
                  <td>${dateStr}${autoBadge}</td>
                  <td>${bBadge}</td>
                  <td>${formatTime(e.clock_in)}</td>
                  <td>${formatTime(e.clock_out)}</td>
                  <td>${formatHours(dur)}</td>
                  <td style="color:var(--green); font-weight:600;">${formatCurrency(pay)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>`;
    };

    // ── Company Settings ────────────────────────────────
    $('#form-company-settings').addEventListener('submit', async (e) => {
        e.preventDefault();
        const session = getSession();
        if (!session) return;

        const name = $('#setting-company-name').value.trim();
        const hourlyRate = parseFloat($('#setting-hourly-rate').value) || 0;

        const { error } = await sb.from('companies').update({ name, hourly_rate: hourlyRate }).eq('id', session.company_id);
        if (error) {
            toast('Failed to save settings: ' + error.message, 'error');
            return;
        }
        toast('Settings saved ✅');
    });

    // ── Branches Settings ───────────────────────────────
    async function renderBranchesSettings(company) {
        const container = $('#branches-list');
        const branches = company.branches || [];

        // Populate filter dropdown
        const filterSelect = $('#attendance-branch-filter');
        filterSelect.innerHTML = '<option value="all">All Branches</option>';
        branches.forEach(b => {
            filterSelect.innerHTML += `<option value="${b}">${b}</option>`;
        });

        if (branches.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">No branches added yet.</p>';
            return;
        }

        container.innerHTML = branches.map(b => `
      <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:6px; margin-bottom:4px;">
        <span>${b}</span>
        <button class="btn btn-sm btn-outline" style="color:var(--red); border-color:var(--red-dim);" onclick="window.removeBranch('${b}')">Remove</button>
      </div>
    `).join('');
    }

    $('#btn-add-branch').addEventListener('click', async (e) => {
        e.preventDefault();
        const session = getSession();
        if (!session) return;

        const input = $('#new-branch-name');
        const name = input.value.trim();
        if (!name) return;

        const { data: company } = await sb.from('companies').select('*').eq('id', session.company_id).single();
        if (!company) return;

        const branches = company.branches || [];
        if (!branches.includes(name)) {
            branches.push(name);
            await sb.from('companies').update({ branches }).eq('id', session.company_id);
            toast('Branch added 🏢');
            input.value = '';
            const updatedCompany = { ...company, branches };
            await renderBranchesSettings(updatedCompany);
            await renderOwnerAttendance(updatedCompany);
        }
    });

    window.removeBranch = async function (branchName) {
        if (!confirm(`Remove branch "${branchName}"?`)) return;
        const session = getSession();
        const { data: company } = await sb.from('companies').select('*').eq('id', session.company_id).single();
        if (!company) return;

        const branches = (company.branches || []).filter(b => b !== branchName);
        await sb.from('companies').update({ branches }).eq('id', session.company_id);
        toast('Branch removed');
        const updatedCompany = { ...company, branches };
        await renderBranchesSettings(updatedCompany);
        await renderOwnerAttendance(updatedCompany);
    };

    // ── Owner Attendance Tab ────────────────────────────
    async function renderOwnerAttendance(company) {
        const container = $('#owner-attendance-list');
        const period      = $('#attendance-period').value;
        const branchFilter = $('#attendance-branch-filter').value;
        const now = new Date();
        let periodStart, periodEnd;

        if (period === 'custom') {
            const fromVal = $('#attendance-date-from').value;
            const toVal   = $('#attendance-date-to').value;
            if (!fromVal || !toVal) {
                container.innerHTML = '<p class="empty-state">Please select both Date From and Date To</p>';
                return;
            }
            periodStart = new Date(fromVal); periodStart.setHours(0, 0, 0, 0);
            periodEnd   = new Date(toVal);   periodEnd.setHours(23, 59, 59, 999);
        } else {
            if (period === 'daily')   periodStart = startOfDay(now);
            else if (period === 'weekly')  periodStart = startOfWeek(now);
            else                           periodStart = startOfMonth(now);
            periodEnd = now;
        }

        let query = sb
            .from('time_entries')
            .select('*, users!inner(name)')
            .eq('company_id', company.id)
            .gte('clock_in', periodStart.toISOString())
            .lte('clock_in', periodEnd.toISOString())
            .order('clock_in', { ascending: false });

        if (branchFilter && branchFilter !== 'all') {
            query = query.eq('branch', branchFilter);
        }

        const { data: entries, error } = await query;
        if (error) {
            console.error(error);
            container.innerHTML = '<p class="empty-state">Error loading attendance</p>';
            return;
        }

        if (!entries || entries.length === 0) {
            container.innerHTML = '<p class="empty-state">No attendance logs found for this period</p>';
            return;
        }

        const formatEditableDate = (iso) => {
            if (!iso) return '';
            const d = new Date(iso);
            const pad = n => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };

        let html = `<table class="attendance-table">
      <thead>
        <tr>
          <th>Staff</th>
          <th>Branch</th>
          <th>Clock In</th>
          <th>Clock Out</th>
          <th>Hours</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>`;

        entries.forEach(e => {
            const dur = e.clock_out ? new Date(e.clock_out) - new Date(e.clock_in) : null;
            const userName = e.users ? e.users.name : 'Unknown';
            const bBadge = e.branch ? `<span class="branch-badge">${e.branch}</span>` : '—';
            const autoBadge = e.auto_clocked_out ? ' <span class="auto-badge" title="Auto clocked out">\u26a0\ufe0f</span>' : '';

            const inVal  = formatEditableDate(e.clock_in);
            const outVal = formatEditableDate(e.clock_out);

            html += `<tr>
        <td style="font-weight:500;">${userName}${autoBadge}</td>
        <td>${bBadge}</td>
        <td>
          <input type="datetime-local" class="inline-edit-input" style="width:auto;" id="edit-in-${e.id}" value="${inVal}">
        </td>
        <td>
          <input type="datetime-local" class="inline-edit-input" style="width:auto;" id="edit-out-${e.id}" value="${outVal}">
        </td>
        <td>${dur ? formatHours(dur) : '<span style="color:var(--green)">Active</span>'}</td>
        <td style="display:flex; gap:6px; align-items:center;">
          <button class="btn btn-save-sm" onclick="window.saveAttendanceEdit('${e.id}')">Save</button>
          <button class="btn btn-sm btn-outline" style="color:var(--red); border-color:var(--red); padding:4px 10px; font-size:12px;" onclick="window.deleteAttendanceEntry('${e.id}')">🗑 Del</button>
        </td>
      </tr>`;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;
    }

    window.saveAttendanceEdit = async function (entryId) {
        const inVal  = $('#edit-in-'  + entryId).value;
        const outVal = $('#edit-out-' + entryId).value;

        if (!inVal) {
            toast('Clock-in time is required', 'error');
            return;
        }

        const payload = { clock_in: new Date(inVal).toISOString() };
        if (outVal) {
            payload.clock_out = new Date(outVal).toISOString();
            payload.auto_clocked_out = false;
        } else {
            payload.clock_out = null;
        }

        const { error } = await sb.from('time_entries').update(payload).eq('id', entryId);
        if (error) { toast('Failed to save attendance', 'error'); return; }

        toast('Attendance updated ✅');
        const session = getSession();
        const { data: company } = await sb.from('companies').select('*').eq('id', session.company_id).single();
        await renderOwnerAttendance(company);
        await renderSalaryReport(company);
    };

    window.deleteAttendanceEntry = async function (entryId) {
        if (!confirm('Delete this attendance record? This cannot be undone.')) return;
        const { error } = await sb.from('time_entries').delete().eq('id', entryId);
        if (error) { toast('Failed to delete record', 'error'); return; }
        toast('Record deleted 🗑', 'success');
        const session = getSession();
        const { data: company } = await sb.from('companies').select('*').eq('id', session.company_id).single();
        await renderOwnerAttendance(company);
        await renderSalaryReport(company);
    };

    // ─────────────────────────────────────────────────────
    // OWNER: TASK MANAGEMENT
    // ─────────────────────────────────────────────────────
    $('#form-create-task').addEventListener('submit', async (e) => {
        e.preventDefault();
        const session = getSession();
        if (!session) return;

        const title = $('#task-title').value.trim();
        const description = $('#task-description').value.trim();
        const rewardPoints = parseInt($('#task-reward').value) || 0;

        if (rewardPoints < 1) {
            toast('Reward points must be at least 1', 'error');
            return;
        }

        const { error } = await sb.from('tasks').insert({
            title,
            description,
            reward_points: rewardPoints,
            company_id: session.company_id,
        });

        if (error) {
            toast('Failed to create task: ' + error.message, 'error');
            return;
        }

        toast('Task created! 🎯');
        $('#form-create-task').reset();

        const { data: company } = await sb.from('companies').select('*').eq('id', session.company_id).single();

        // --> TRIGGER NOTIFICATIONS TO STAFF
        const { data: staffList } = await sb
            .from('join_requests')
            .select('user_id')
            .eq('company_id', session.company_id)
            .eq('status', 'APPROVED');

        if (staffList && staffList.length > 0) {
            const notifs = staffList.map(s => ({
                user_id: s.user_id,
                company_id: session.company_id,
                title: 'New Task Available! 🎯',
                message: `${session.name} just posted: ${title}`
            }));
            await sb.from('notifications').insert(notifs);
        }

        await renderOwnerTasks(company);
    });

    async function renderOwnerTasks(company) {
        const container = $('#owner-tasks-list');
        const { data: tasks, error } = await sb
            .from('tasks')
            .select('*')
            .eq('company_id', company.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('renderOwnerTasks error:', error);
            container.innerHTML = '<p class="empty-state">Error loading tasks</p>';
            return;
        }

        if (!tasks || tasks.length === 0) {
            container.innerHTML = '<p class="empty-state">No tasks created yet</p>';
            return;
        }

        container.innerHTML = tasks.map(t => `
      <div class="task-item">
        <div class="task-info">
          <h4>${t.title}</h4>
          <p>${t.description}</p>
          <span class="task-reward-badge">🎯 ${t.reward_points} points</span>
        </div>
        <div class="task-actions">
          <button class="btn btn-delete-task" onclick="window.deleteTask('${t.id}')">🗑️ Delete</button>
        </div>
      </div>
    `).join('');
    }

    window.deleteTask = async function (taskId) {
        if (!confirm('Delete this task? Any pending submissions will remain.')) return;
        const { error } = await sb.from('tasks').delete().eq('id', taskId);
        if (error) {
            toast('Failed to delete task: ' + error.message, 'error');
            return;
        }
        toast('Task deleted 🗑️');

        const session = getSession();
        const { data: company } = await sb.from('companies').select('*').eq('id', session.company_id).single();
        await renderOwnerTasks(company);
    };

    // ─────────────────────────────────────────────────────
    // OWNER: SUBMISSION REVIEW
    // ─────────────────────────────────────────────────────
    async function renderOwnerSubmissions(company) {
        // Use left join so submissions still show even if task was deleted
        const { data: allSubs, error } = await sb
            .from('submissions')
            .select('*, users(name), tasks(title, reward_points)')
            .eq('company_id', company.id)
            .order('created_at', { ascending: false });

        if (error) console.error('renderOwnerSubmissions error:', error);
        const submissions = allSubs || [];

        const pending = (submissions || []).filter(s => s.status === 'PENDING');
        const approved = (submissions || []).filter(s => s.status === 'APPROVED');

        // Pending
        const pendingContainer = $('#owner-submissions-pending');
        if (pending.length === 0) {
            pendingContainer.innerHTML = '<p class="empty-state">No pending submissions 🎉</p>';
        } else {
            pendingContainer.innerHTML = pending.map(s => `
        <div class="submission-item">
          <img class="submission-thumb" src="${s.image}" alt="Proof" onclick="window.viewImage('${s.id}')">
          <div class="submission-info">
            <h4>${s.tasks.title}</h4>
            <div class="sub-meta">By ${s.users.name} · ${formatDate(s.created_at)}</div>
            ${s.note ? `<div class="sub-note">"${s.note}"</div>` : ''}
            <span class="task-reward-badge" style="margin-top:6px;">🎯 ${s.tasks.reward_points} points</span>
          </div>
          <div class="submission-actions">
            <button class="btn btn-approve" onclick="window.approveSubmission('${s.id}', '${s.user_id}', '${s.task_id}')">✅</button>
            <button class="btn btn-reject" onclick="window.rejectSubmission('${s.id}')">❌</button>
          </div>
        </div>`).join('');
        }

        // Approved
        const approvedContainer = $('#owner-submissions-approved');
        if (approved.length === 0) {
            approvedContainer.innerHTML = '<p class="empty-state">No approved submissions yet</p>';
        } else {
            approvedContainer.innerHTML = approved.slice(0, 20).map(s => `
        <div class="submission-item">
          <img class="submission-thumb" src="${s.image}" alt="Proof" onclick="window.viewImage('${s.id}')">
          <div class="submission-info">
            <h4>${s.tasks.title}</h4>
            <div class="sub-meta">By ${s.users.name} · ${formatDate(s.created_at)}</div>
            ${s.note ? `<div class="sub-note">"${s.note}"</div>` : ''}
          </div>
          <span class="submission-status approved">✅ Approved</span>
        </div>`).join('');
        }
    }

    window.approveSubmission = async function (subId, userId, taskId) {
        await sb.from('submissions').update({ status: 'APPROVED' }).eq('id', subId);

        // Auto-reject any other pending submissions for this task
        await sb.from('submissions')
            .update({ status: 'REJECTED' })
            .eq('task_id', taskId)
            .eq('status', 'PENDING')
            .neq('id', subId);

        // Mark task as completed
        await sb.from('tasks').update({ completed: true }).eq('id', taskId);

        // Get task reward points
        const { data: task } = await sb.from('tasks').select('reward_points').eq('id', taskId).single();
        if (task) {
            const { data: user } = await sb.from('users').select('total_points').eq('id', userId).single();
            const currentPoints = user.total_points || 0;
            await sb.from('users').update({ total_points: currentPoints + task.reward_points }).eq('id', userId);
        }

        toast('Submission approved! Task completed \u2705');

        const session = getSession();
        const { data: company } = await sb.from('companies').select('*').eq('id', session.company_id).single();
        await renderOwnerSubmissions(company);
        await renderStaffList(company);
        await renderOwnerTasks(company);
    };

    window.rejectSubmission = async function (subId) {
        await sb.from('submissions').update({ status: 'REJECTED' }).eq('id', subId);
        toast('Submission rejected ❌');

        const session = getSession();
        const { data: company } = await sb.from('companies').select('*').eq('id', session.company_id).single();
        await renderOwnerSubmissions(company);
    };

    // Image viewer
    let viewerImageCache = {};

    window.viewImage = async function (subId) {
        if (viewerImageCache[subId]) {
            $('#viewer-image').src = viewerImageCache[subId];
        } else {
            const { data: sub } = await sb.from('submissions').select('image').eq('id', subId).single();
            if (sub) {
                viewerImageCache[subId] = sub.image;
                $('#viewer-image').src = sub.image;
            }
        }
        $('#modal-image-viewer').classList.add('open');
    };

    $('#btn-close-image-viewer').addEventListener('click', () => {
        $('#modal-image-viewer').classList.remove('open');
    });

    $('#modal-image-viewer').addEventListener('click', (e) => {
        if (e.target === $('#modal-image-viewer')) {
            $('#modal-image-viewer').classList.remove('open');
        }
    });

    // ─────────────────────────────────────────────────────
    // STAFF DASHBOARD
    // ─────────────────────────────────────────────────────
    let elapsedInterval = null;
    let currentActiveEntry = null;
    let cachedRecentEntries = []; // module-level cache for recent entries

    async function enterStaffDashboard(user) {
        showView('view-staff-dashboard');

        const { data: company } = await sb.from('companies').select('*').eq('id', user.company_id).single();
        if (!company) return;

        $('#staff-name').textContent = user.name;
        $('#staff-avatar').textContent = user.name.charAt(0).toUpperCase();
        $('#staff-company-name').textContent = company.name;
        $('#staff-hourly-rate').textContent = formatCurrency(company.hourly_rate) + '/hr';

        // Branch selection is now handled via QR code scan — no manual dropdown needed

        initTabs($('#view-staff-dashboard'));
        startLiveClock();

        // Check for active clock-in
        const { data: active } = await sb
            .from('time_entries')
            .select('*')
            .eq('user_id', user.id)
            .is('clock_out', null)
            .maybeSingle();

        if (active) {
            currentActiveEntry = active;
            setClockedInState(true);
            startElapsedTimer(new Date(active.clock_in));
        } else {
            currentActiveEntry = null;
            setClockedInState(false);
        }

        await loadEntriesCache(user);
        renderTodayEntries();
        await renderHoursSummary(user, company);
        await renderEarningsSummary(user, company);
        await renderStaffTasks(company, user);
        await renderStaffRewards(user);

        // Profile tab
        const staffEl = $('#staff-name');
        if (staffEl) staffEl.textContent = user.name;
        setAvatar('#staff-avatar', user);
        $('#staff-profile-name').textContent = user.name;
        $('#staff-profile-email').textContent = user.email;
        setAvatarLarge('#staff-profile-avatar-preview', user);

        // Profile upload
        $('#staff-profile-upload').onchange = (e) => handleProfileUpload(e, user, '#staff-avatar', '#staff-profile-avatar-preview');
        $('#btn-staff-profile-logout').onclick = logout;
        $('#btn-staff-switch-account').onclick = logout;

        // Hours filter buttons
        $('#btn-hours-filter-apply').addEventListener('click', async () => {
            const from = $('#hours-filter-from').value;
            const to   = $('#hours-filter-to').value;
            if (!from || !to) { toast('Please select both From and To dates', 'error'); return; }
            await renderHoursSummary(user, company, from, to);
        });
        $('#btn-hours-filter-clear').addEventListener('click', async () => {
            $('#hours-filter-from').value = '';
            $('#hours-filter-to').value = '';
            const summaryEl = $('#hours-filter-summary');
            if (summaryEl) summaryEl.style.display = 'none';
            await renderHoursSummary(user, company);
        });

        // Process any pending QR clock action (from deep-link scan before login)
        await processPendingQR();
    }

    function setClockedInState(isClockedIn) {
        const status = $('#clock-status');
        const qrBtn  = $('#btn-open-qr-scanner');
        const qrSub  = $('#qr-btn-status');

        if (isClockedIn) {
            status.textContent = '🟢 Currently clocked in';
            status.style.color = 'var(--green)';
            if (qrBtn) qrBtn.classList.add('clocked-in');
            if (qrSub) qrSub.textContent = 'Scan QR code to Clock Out';
        } else {
            status.textContent = 'Not clocked in';
            status.style.color = 'var(--text-muted)';
            $('#clock-elapsed').textContent = '';
            if (qrBtn) qrBtn.classList.remove('clocked-in');
            if (qrSub) qrSub.textContent = 'Point camera at your branch QR code';
        }
    }

    function startElapsedTimer(startTime) {
        clearInterval(elapsedInterval);
        function tick() {
            const diff = Date.now() - startTime.getTime();
            $('#clock-elapsed').textContent = formatHours(diff);

            const remaining = AUTO_CLOCK_OUT_MS - diff;
            if (remaining > 0 && remaining < 15 * 60 * 1000) {
                const mins = Math.ceil(remaining / 60000);
                $('#clock-status').textContent = `⚠️ Auto clock-out in ${mins} min`;
                $('#clock-status').style.color = 'var(--yellow)';
            }
        }
        tick();
        elapsedInterval = setInterval(tick, 1000);
    }

    $('#btn-clock-in').addEventListener('click', async () => {
        const session = getSession();
        if (!session) return;

        const branchSelect = $('#clock-branch-select');
        let branch = null;
        if (branchSelect.options.length > 0 && branchSelect.parentElement.style.display !== 'none') {
            branch = branchSelect.value;
            if (!branch) {
                toast('Please select a branch first', 'error');
                return;
            }
        }

        const { data: entry, error } = await sb.from('time_entries').insert({
            user_id: session.id,
            company_id: session.company_id,
            clock_in: new Date().toISOString(),
            clock_out: null,
            auto_clocked_out: false,
            branch: branch
        }).select().single();

        if (error) {
            toast('Clock in failed: ' + error.message, 'error');
            return;
        }

        currentActiveEntry = entry;
        // Prepend new entry to cache so it shows immediately
        cachedRecentEntries = [entry, ...cachedRecentEntries].slice(0, 20);
        setClockedInState(true);
        startElapsedTimer(new Date(entry.clock_in));
        toast('Clocked in! 🟢');
        renderTodayEntries();
    });

    // Clock Out
    $('#btn-clock-out').addEventListener('click', async () => {
        const session = getSession();
        if (!session || !currentActiveEntry) return;

        const clockOut = new Date().toISOString();
        await sb.from('time_entries').update({ clock_out: clockOut }).eq('id', currentActiveEntry.id);

        clearInterval(elapsedInterval);
        // Update the cached entry with the clock-out time
        const idx = cachedRecentEntries.findIndex(e => e.id === currentActiveEntry.id);
        if (idx !== -1) cachedRecentEntries[idx] = { ...cachedRecentEntries[idx], clock_out: clockOut };
        currentActiveEntry = null;
        setClockedInState(false);
        toast('Clocked out! 🔴');
        renderTodayEntries();

        const { data: company } = await sb.from('companies').select('*').eq('id', session.company_id).single();
        await renderHoursSummary(session, company);
        await renderEarningsSummary(session, company);
    });

    // ── Load Entries into Cache (called once on dashboard init) ──────────
    async function loadEntriesCache(user) {
        try {
            const { data: fetched, error } = await sb
                .from('time_entries')
                .select('id, user_id, clock_in, clock_out, branch, auto_clocked_out, created_at')
                .eq('user_id', user.id)
                .order('clock_in', { ascending: false })
                .limit(20);

            if (error) {
                console.error('[loadEntriesCache] Supabase error:', error);
                // Don't wipe existing cache on error
                return;
            }

            console.log('[loadEntriesCache] fetched:', fetched ? fetched.length : 'null', 'rows for user', user.id);
            cachedRecentEntries = fetched || [];
        } catch (e) {
            console.error('[loadEntriesCache] Exception:', e);
        }
    }

    // ── Recent Entries — renders from cache only, no DB call ─────────────
    function renderTodayEntries() {
        const container = $('#today-entries-list');

        // Build display list from cache, ensuring active entry is at top
        let entries = [...cachedRecentEntries];
        if (currentActiveEntry) {
            const alreadyIn = entries.some(e => e.id === currentActiveEntry.id);
            if (!alreadyIn) entries = [currentActiveEntry, ...entries];
        }
        entries = entries.slice(0, 5);

        if (entries.length === 0) {
            container.innerHTML = '<p class="empty-state">No clock-in history yet</p>';
            return;
        }

        container.innerHTML = entries.map(e => {
            const dur = e.clock_out ? new Date(e.clock_out) - new Date(e.clock_in) : null;
            const autoBadge = e.auto_clocked_out ? '<span class="auto-badge">\u26a0\ufe0f Auto</span>' : '';
            const bBadge = e.branch ? `<span class="branch-badge">${e.branch}</span>` : '';
            const inDate = new Date(e.clock_in);
            const dayName = inDate.toLocaleDateString('en-GB', { weekday: 'short' });
            return `
        <div class="entry-row">
          <span class="entry-time">${dayName} ${formatTime(e.clock_in)} \u2192 ${e.clock_out ? formatTime(e.clock_out) : '<span style="color:var(--green);">Active \u25cf</span>'}${autoBadge}${bBadge}</span>
          <span class="entry-duration">${dur ? formatHours(dur) : '\u23f1\ufe0f Running\u2026'}</span>
        </div>`;
        }).join('');
    }

    // ── Hours Summary ───────────────────────────────────
    async function renderHoursSummary(user, company, filterFrom, filterTo) {
        const now = new Date();
        const isFiltered = filterFrom && filterTo;
        const rate = company ? Number(company.hourly_rate) : 0;

        // Always recalculate the Today/Week/Month stat cards from live data
        const { data: monthEntries } = await sb
            .from('time_entries')
            .select('*')
            .eq('user_id', user.id)
            .gte('clock_in', startOfMonth(now).toISOString());

        const allEntries = monthEntries || [];
        $('#stat-today-hours').textContent = formatHours(totalHoursInPeriod(allEntries, user.id, startOfDay(now)));
        $('#stat-week-hours').textContent  = formatHours(totalHoursInPeriod(allEntries, user.id, startOfWeek(now)));
        $('#stat-month-hours').textContent = formatHours(totalHoursInPeriod(allEntries, user.id, startOfMonth(now)));

        // Build history query — filtered or recent 30
        let histQuery = sb
            .from('time_entries')
            .select('*')
            .eq('user_id', user.id)
            .order('clock_in', { ascending: false });

        if (isFiltered) {
            const startObj = new Date(filterFrom); startObj.setHours(0, 0, 0, 0);
            const endObj   = new Date(filterTo);   endObj.setHours(23, 59, 59, 999);
            histQuery = histQuery
                .gte('clock_in', startObj.toISOString())
                .lte('clock_in', endObj.toISOString());
        } else {
            histQuery = histQuery.limit(30);
        }

        const { data: hist } = await histQuery;

        // Filtered totals summary card
        const summaryEl = $('#hours-filter-summary');
        if (isFiltered && summaryEl) {
            const completedHist = (hist || []).filter(e => e.clock_out);
            const totalMs  = completedHist.reduce((s, e) => s + (new Date(e.clock_out) - new Date(e.clock_in)), 0);
            const totalPay = (totalMs / 3600000) * rate;
            $('#filter-total-hours').textContent    = formatHours(totalMs);
            $('#filter-total-pay').textContent      = formatCurrency(totalPay);
            $('#filter-total-sessions').textContent = completedHist.length;
            summaryEl.style.display = 'block';
        } else if (summaryEl) {
            summaryEl.style.display = 'none';
        }

        // Render history list
        const histContainer = $('#hours-history-list');
        if (!hist || hist.length === 0) {
            histContainer.innerHTML = isFiltered
                ? '<p class="empty-state">No sessions found in this date range</p>'
                : '<p class="empty-state">No history yet</p>';
            return;
        }

        histContainer.innerHTML = hist.map(e => {
            const dur = e.clock_out
                ? new Date(e.clock_out) - new Date(e.clock_in)
                : new Date() - new Date(e.clock_in);
            const pay = e.clock_out ? formatCurrency((dur / 3600000) * rate) : null;
            const day = new Date(e.clock_in).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
            const autoBadge = e.auto_clocked_out ? '<span class="auto-badge">⚠️ Auto</span>' : '';
            const bBadge = e.branch ? `<span class="branch-badge">${e.branch}</span>` : '';
            return `
        <div class="entry-row">
          <span class="entry-time">${day} — ${formatTime(e.clock_in)} → ${e.clock_out ? formatTime(e.clock_out) : '<span style="color:var(--green);">Active &#9679;</span>'}${autoBadge}${bBadge}</span>
          <span class="entry-duration">${e.clock_out ? formatHours(dur) : '\u23f1\ufe0f Running\u2026'}${pay ? ` <span style="color:var(--green);font-size:11px;margin-left:4px;">${pay}</span>` : ''}</span>
        </div>`;
        }).join('');
    }

    // ── Earnings Summary ────────────────────────────────
    async function renderEarningsSummary(user, company) {
        if (!company) return;
        const now = new Date();
        const rate = Number(company.hourly_rate);

        const { data: entries } = await sb
            .from('time_entries')
            .select('*')
            .eq('user_id', user.id)
            .gte('clock_in', startOfMonth(now).toISOString());

        const allEntries = entries || [];

        const todayMs = totalHoursInPeriod(allEntries, user.id, startOfDay(now));
        const weekMs = totalHoursInPeriod(allEntries, user.id, startOfWeek(now));
        const monthMs = totalHoursInPeriod(allEntries, user.id, startOfMonth(now));

        $('#stat-today-earnings').textContent = formatCurrency((todayMs / 3600000) * rate);
        $('#stat-week-earnings').textContent = formatCurrency((weekMs / 3600000) * rate);
        $('#stat-month-earnings').textContent = formatCurrency((monthMs / 3600000) * rate);
        $('#staff-hourly-rate').textContent = formatCurrency(rate) + '/hr';
    }

    // ─────────────────────────────────────────────────────
    // STAFF: VIEW TASKS
    // ─────────────────────────────────────────────────────
    async function renderStaffTasks(company, user) {
        const container = $('#staff-tasks-list');

        // 1. Get all incomplete tasks
        const { data: allTasks, error } = await sb
            .from('tasks')
            .select('*')
            .eq('company_id', company.id)
            .eq('completed', false)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('renderStaffTasks error:', error);
            container.innerHTML = '<p class="empty-state">Error loading tasks</p>';
            return;
        }

        if (!allTasks || allTasks.length === 0) {
            container.innerHTML = '<p class="empty-state">No tasks available right now</p>';
            return;
        }

        // 2. Get all actively PENDING or APPROVED submissions for this company
        const { data: activeSubs } = await sb
            .from('submissions')
            .select('task_id, user_id')
            .eq('company_id', company.id)
            .in('status', ['PENDING', 'APPROVED']);

        // Map: task_id -> user_id who locked it
        const activeTaskMap = {};
        if (activeSubs) {
            activeSubs.forEach(s => activeTaskMap[s.task_id] = s.user_id);
        }

        // 3. Mathematical filter: Hide tasks if they are locked by someone else
        const visibleTasks = allTasks.filter(t => {
            const lockedBy = activeTaskMap[t.id];
            if (!lockedBy) return true; // No one claimed it yet! 🔓
            if (lockedBy === user.id) return true; // Current user claimed it (show submitted status) 📤
            return false; // Someone else claimed it; hide it magically! 🚫
        });

        if (visibleTasks.length === 0) {
            container.innerHTML = '<p class="empty-state">Your team already claimed all the active tasks!</p>';
            return;
        }

        container.innerHTML = visibleTasks.map(t => {
            const alreadySubmitted = (activeTaskMap[t.id] === user.id);
            const actionBtn = alreadySubmitted
                ? '<span class="submission-status pending">📤 Submitted</span>'
                : `<button class="btn btn-submit-proof" onclick="window.openSubmitModal('${t.id}')">📸 Submit Proof</button>`;
            return `
        <div class="task-item">
          <div class="task-info">
            <h4>${t.title}</h4>
            <p>${t.description}</p>
            <span class="task-reward-badge">🎯 ${t.reward_points} points</span>
          </div>
          <div class="task-actions">
            ${actionBtn}
          </div>
        </div>`;
        }).join('');
    }

    // ─────────────────────────────────────────────────────
    // STAFF: SUBMIT PROOF MODAL
    // ─────────────────────────────────────────────────────
    let currentSubmitTaskId = null;
    let currentImageData = null;

    window.openSubmitModal = async function (taskId) {
        const { data: task } = await sb.from('tasks').select('*').eq('id', taskId).single();
        if (!task) return;

        currentSubmitTaskId = taskId;
        currentImageData = null;

        $('#modal-task-name').textContent = task.title;
        $('#modal-task-points').textContent = `🎯 ${task.reward_points} points`;
        $('#proof-note').value = '';
        $('#upload-preview').src = '';
        $('#upload-zone').classList.remove('has-image');
        $('#btn-confirm-submit').disabled = true;
        $('#proof-image-input').value = '';

        $('#modal-submit-proof').classList.add('open');
    };

    function closeSubmitModal() {
        $('#modal-submit-proof').classList.remove('open');
        currentSubmitTaskId = null;
        currentImageData = null;
    }

    $('#btn-close-modal').addEventListener('click', closeSubmitModal);
    $('#btn-cancel-submit').addEventListener('click', closeSubmitModal);
    $('#modal-submit-proof').addEventListener('click', (e) => {
        if (e.target === $('#modal-submit-proof')) closeSubmitModal();
    });

    // Upload zone
    const uploadZone = $('#upload-zone');
    const fileInput = $('#proof-image-input');

    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
    uploadZone.addEventListener('dragleave', () => { uploadZone.classList.remove('dragover'); });
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) handleImageFile(file);
    });
    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (file) handleImageFile(file);
    });

    function handleImageFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxSize = 400;
                let w = img.width, h = img.height;
                if (w > maxSize || h > maxSize) {
                    if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
                    else { w = Math.round(w * maxSize / h); h = maxSize; }
                }
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                currentImageData = canvas.toDataURL('image/jpeg', 0.6);
                $('#upload-preview').src = currentImageData;
                uploadZone.classList.add('has-image');
                $('#btn-confirm-submit').disabled = false;
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // Confirm submission
    $('#btn-confirm-submit').addEventListener('click', async () => {
        const session = getSession();
        if (!session || !currentSubmitTaskId || !currentImageData) return;

        const { error } = await sb.from('submissions').insert({
            user_id: session.id,
            task_id: currentSubmitTaskId,
            company_id: session.company_id,
            image: currentImageData,
            note: $('#proof-note').value.trim(),
            status: 'PENDING',
        });

        if (error) {
            toast('Submission failed: ' + error.message, 'error');
            return;
        }

        toast('Proof submitted! Waiting for approval 📤');

        // --> TRIGGER NOTIFICATION TO OWNER
        // 1. Get the task title
        const { data: taskObj } = await sb.from('tasks').select('title').eq('id', currentSubmitTaskId).single();

        // 2. Find the owner(s) of this company
        const { data: owners } = await sb
            .from('users')
            .select('id')
            .eq('company_id', session.company_id)
            .eq('role', 'owner');

        if (owners && owners.length > 0 && taskObj) {
            const bNotifs = owners.map(o => ({
                user_id: o.id,
                company_id: session.company_id,
                title: 'Task Submission! 📸',
                message: `${session.name} just submitted proof for: ${taskObj.title}`
            }));
            await sb.from('notifications').insert(bNotifs);
        }

        closeSubmitModal();

        const { data: company } = await sb.from('companies').select('*').eq('id', session.company_id).single();
        await renderStaffTasks(company, session);
        await renderStaffRewards(session);
    });

    // ─────────────────────────────────────────────────────
    // STAFF: REWARDS (Points & Coins)
    // ─────────────────────────────────────────────────────
    async function renderStaffRewards(user) {
        const { data: freshUser } = await sb.from('users').select('total_points').eq('id', user.id).single();
        const points = freshUser ? (freshUser.total_points || 0) : 0;
        const coins = Math.floor(points / 1000);

        $('#stat-total-points').textContent = points.toLocaleString();
        $('#stat-total-coins').textContent = coins;

        // Submissions history
        const container = $('#staff-submissions-list');
        const { data: submissions } = await sb
            .from('submissions')
            .select('*, tasks!inner(title)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (!submissions || submissions.length === 0) {
            container.innerHTML = '<p class="empty-state">No submissions yet — complete a task to earn points!</p>';
            return;
        }

        container.innerHTML = submissions.map(s => {
            const statusClass = s.status.toLowerCase();
            const statusText = s.status === 'PENDING' ? '⏳ Pending'
                : s.status === 'APPROVED' ? '✅ Approved'
                    : '❌ Rejected';
            return `
        <div class="submission-item">
          <img class="submission-thumb" src="${s.image}" alt="Proof">
          <div class="submission-info">
            <h4>${s.tasks.title}</h4>
            <div class="sub-meta">${formatDate(s.created_at)}</div>
            ${s.note ? `<div class="sub-note">"${s.note}"</div>` : ''}
          </div>
          <span class="submission-status ${statusClass}">${statusText}</span>
        </div>`;
        }).join('');
    }

    // ─────────────────────────────────────────────────────
    // SUPER ADMIN
    // ─────────────────────────────────────────────────────
    window.enterSuperAdminDashboard = async function () {
        showView('view-super-admin-dashboard');
        initTabs($('#view-super-admin-dashboard'));
        await renderAdminBusinesses();
        // Profile tab
        const session = getSession();
        if (session) {
            $('#admin-profile-name').textContent = session.name || 'Super Admin';
            $('#admin-profile-email').textContent = session.email || '';
            setAvatarLarge('#admin-profile-avatar-preview', session);
            $('#admin-profile-upload').onchange = (e) => handleProfileUpload(e, session, null, '#admin-profile-avatar-preview');
        }
        $('#btn-admin-profile-logout').onclick = logout;
        $('#btn-admin-switch-account').onclick = logout;
    };

    $('#btn-refresh-admin').addEventListener('click', async () => {
        await renderAdminBusinesses();
        toast('List refreshed');
    });

    let _cachedOwners = [];
    let _cachedCompanyMap = {};

    async function renderAdminBusinesses() {
        const container = $('#admin-businesses-list');

        // Clear search on refresh
        const searchEl = $('#admin-owner-search');
        if (searchEl) searchEl.value = '';

        // Fetch all users with role 'owner'
        const { data: owners, error } = await sb
            .from('users')
            .select('*')
            .eq('role', 'owner')
            .order('created_at', { ascending: false });

        if (error) {
            console.error(error);
            container.innerHTML = '<p class="empty-state">Error loading owners</p>';
            return;
        }

        if (!owners || owners.length === 0) {
            container.innerHTML = '<p class="empty-state">No businesses registered yet.</p>';
            return;
        }

        const companyIds = owners.map(o => o.company_id).filter(id => id);
        let companyMap = {};
        if (companyIds.length > 0) {
            const { data: companies } = await sb.from('companies').select('*').in('id', companyIds);
            if (companies) companies.forEach(c => companyMap[c.id] = c);
        }

        // Cache for filtering
        _cachedOwners = owners;
        _cachedCompanyMap = companyMap;

        renderOwnerCards(owners, companyMap);
    }

    function renderOwnerCards(owners, companyMap) {
        const container = $('#admin-businesses-list');

        if (!owners || owners.length === 0) {
            container.innerHTML = '<p class="empty-state">No results found.</p>';
            return;
        }

        container.innerHTML = owners.map(o => {
            const comp = companyMap[o.company_id] || { name: 'Unknown', code: 'N/A' };
            const statusBadge = o.owner_approved ? '<span class="status-badge approved">✅ Approved</span>' : '<span class="status-badge pending">🚫 Blocked / Pending</span>';
            return `
      <div class="staff-card card glass">
        <div class="staff-info" onclick="window.viewBusinessStaff('${o.company_id}', '${comp.name.replace(/'/g, "\\'")}')" style="cursor:pointer; position:relative; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.05); margin-bottom:8px;" title="View Registered Staff">
          <div class="avatar">
            ${o.profile_image ? `<img src="${o.profile_image}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : o.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3>${o.name}</h3>
            <p>${o.email}</p>
          </div>
        </div>
        <div style="margin: 8px 0; display:flex; flex-direction:column; gap:4px;">
          <span class="code-badge">🏢 ${comp.name}</span>
          <span class="code-badge" style="background:rgba(67, 97, 238, 0.15); color:var(--blue);">🆔 ${comp.code || 'N/A'}</span>
          ${statusBadge}
        </div>
        <div class="staff-actions" style="margin-top:auto;">
          ${!o.owner_approved
                    ? `<button class="btn btn-primary" style="flex:1" onclick="window.toggleOwnerStatus('${o.id}', true)">✅ Approve</button>
               <button class="btn btn-outline" style="flex:1; border-color:var(--red); color:var(--red);" onclick="window.rejectOwner('${o.id}', '${o.company_id}')">🗑️ Delete</button>`
                    : `<button class="btn btn-outline" style="flex:1; border-color:var(--yellow); color:var(--yellow);" onclick="window.toggleOwnerStatus('${o.id}', false)">🚫 Block</button>`
                }
        </div>
      </div>
      `;
        }).join('');
    }

    window.filterAdminOwners = function (query) {
        const q = query.trim().toLowerCase();
        if (!q) {
            renderOwnerCards(_cachedOwners, _cachedCompanyMap);
            return;
        }
        const filtered = _cachedOwners.filter(o => {
            const comp = _cachedCompanyMap[o.company_id] || {};
            return (
                o.name.toLowerCase().includes(q) ||
                o.email.toLowerCase().includes(q) ||
                (comp.name && comp.name.toLowerCase().includes(q)) ||
                (comp.code && comp.code.toLowerCase().includes(q))
            );
        });
        renderOwnerCards(filtered, _cachedCompanyMap);
    };

    // Attach search listener in JS (not inline HTML) so it fires after app.js initialises
    const adminSearchEl = $('#admin-owner-search');
    if (adminSearchEl) {
        adminSearchEl.addEventListener('input', (e) => {
            window.filterAdminOwners(e.target.value);
        });
    }

    // Previews any base64 image string full screen in existing modal
    window.previewImageModal = function (base64Src, title) {
        if (!base64Src) return;
        $('#viewer-image').src = base64Src;
        const notesEl = $('#viewer-notes');
        if (notesEl) notesEl.innerHTML = `<strong>${title}</strong>`;
        $('#modal-image-viewer').classList.add('open');
    };

    window.toggleOwnerStatus = async function (ownerId, isApproved) {
        await sb.from('users').update({ owner_approved: isApproved }).eq('id', ownerId);
        toast(isApproved ? 'Business unlocked! ✅' : 'Business blocked! 🚫');
        await renderAdminBusinesses();
    };

    window.viewBusinessStaff = async function (companyId, companyName) {
        if (!companyId) {
            toast('No company assigned to this owner yet.', 'error');
            return;
        }

        $('#modal-admin-staff-company-name').textContent = `🏢 ${companyName} - Staff List`;
        const listContainer = $('#modal-admin-staff-list');
        listContainer.innerHTML = '<p style="text-align:center; padding: 20px;">Fetching staff...</p>';
        $('#modal-admin-staff-view').classList.add('open');

        const { data: staffProfiles, error } = await sb
            .from('users')
            .select('*')
            .eq('company_id', companyId)
            .eq('role', 'staff')
            .order('created_at', { ascending: false });

        if (error || !staffProfiles) {
            listContainer.innerHTML = '<p class="empty-state">Error tracking down team directory.</p>';
            return;
        }

        if (staffProfiles.length === 0) {
            listContainer.innerHTML = '<p class="empty-state">No staff members have registered using this Business ID yet.</p>';
            return;
        }

        listContainer.innerHTML = staffProfiles.map(s => {
            return `
            <div class="staff-card card glass" style="display:flex; flex-direction:row; align-items:center; gap:16px;">
                <div class="avatar" style="width:40px; height:40px; font-size:16px;">
                    ${s.profile_image ? `<img src="${s.profile_image}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : s.name.charAt(0).toUpperCase()}
                </div>
                <div style="flex:1;">
                    <h3 style="font-size:16px; margin:0 0 4px 0;">${s.name}</h3>
                    <p style="font-size:12px; margin:0; opacity:0.8;">${s.email}</p>
                </div>
                <span class="status-badge" style="background:rgba(255,255,255,0.05); color:white;">STAFF</span>
            </div>
            `;
        }).join('');
    };

    $('#btn-close-admin-staff-modal').addEventListener('click', () => {
        $('#modal-admin-staff-view').classList.remove('open');
    });

    $('#modal-admin-staff-view').addEventListener('click', (e) => {
        if (e.target === $('#modal-admin-staff-view')) {
            $('#modal-admin-staff-view').classList.remove('open');
        }
    });

    window.rejectOwner = async function (ownerId, companyId) {
        const confirmation = confirm("Are you sure? This will delete their business profile permanently.");
        if (!confirmation) return;

        // Unlink user
        await sb.from('users').update({
            role: null,
            company_id: null,
            status: null,
            owner_approved: false
        }).eq('id', ownerId);

        // Delete company
        if (companyId) {
            await sb.from('companies').delete().eq('id', companyId);
        }

        toast('Business deleted. 🗑️');
        await renderAdminBusinesses();
    };

    // ─────────────────────────────────────────────────────
    // GLOBAL NOTIFICATIONS
    // ─────────────────────────────────────────────────────
    let previousUnreadCount = 0;

    async function renderNotifications() {
        const session = getSession();
        if (!session || !session.id) return;

        const { data: notifs } = await sb
            .from('notifications')
            .select('*')
            .eq('user_id', session.id)
            .order('created_at', { ascending: false })
            .limit(20);

        const ownerBadge = $('#owner-notif-badge');
        const staffBadge = $('#staff-notif-badge');
        const ownerList = $('#owner-notif-list');
        const staffList = $('#staff-notif-list');

        if (!notifs || notifs.length === 0) {
            if (ownerBadge) ownerBadge.style.display = 'none';
            if (staffBadge) staffBadge.style.display = 'none';
            const emptyHTML = '<p class="empty-state">No notifications. You\'re all caught up!</p>';
            if (ownerList) ownerList.innerHTML = emptyHTML;
            if (staffList) staffList.innerHTML = emptyHTML;
            return;
        }

        const unreadCount = notifs.filter(n => !n.is_read).length;

        // Play sound if unread count goes UP
        if (unreadCount > previousUnreadCount) {
            const audio = $('#notification-sound');
            if (audio) {
                audio.play().catch(e => console.log('Audio blocked by browser:', e));
            }
        }
        previousUnreadCount = unreadCount;

        const badgeText = unreadCount > 9 ? '9+' : unreadCount;
        if (unreadCount > 0) {
            if (ownerBadge) { ownerBadge.style.display = 'inline-block'; ownerBadge.textContent = badgeText; }
            if (staffBadge) { staffBadge.style.display = 'inline-block'; staffBadge.textContent = badgeText; }
        } else {
            if (ownerBadge) ownerBadge.style.display = 'none';
            if (staffBadge) staffBadge.style.display = 'none';
        }

        const html = notifs.map(n => `
      <div class="card glass ${!n.is_read ? 'unread-glow' : ''}">
        <h4>${n.title}</h4>
        <p>${n.message}</p>
        <span style="display:block; font-size:10px; color:var(--text-secondary); margin-top:6px; opacity:0.7;">
          ${new Date(n.created_at).toLocaleString()}
        </span>
      </div>
    `).join('');

        if (ownerList) ownerList.innerHTML = html;
        if (staffList) staffList.innerHTML = html;
    }

    async function markAllAsRead() {
        const session = getSession();
        if (!session) return;
        await sb.from('notifications').update({ is_read: true }).eq('user_id', session.id).eq('is_read', false);
        toast('Notifications cleared!');
        renderNotifications();
    }

    if ($('#btn-read-all-notifs-owner')) $('#btn-read-all-notifs-owner').addEventListener('click', markAllAsRead);
    if ($('#btn-read-all-notifs-staff')) $('#btn-read-all-notifs-staff').addEventListener('click', markAllAsRead);

    // Periodically check for new notifications every 30 seconds
    setInterval(renderNotifications, 30000);

    // ─────────────────────────────────────────────────────
    // INIT
    // ─────────────────────────────────────────────────────
    async function init() {
        const session = getSession();
        if (session && session.id) {
            const { data: freshUser } = await sb.from('users').select('*').eq('id', session.id).maybeSingle();
            if (freshUser) {
                setSession(freshUser);
                await routeAfterLogin(freshUser);
                return;
            }
        }
        showView('view-login');
    }

    // ─────────────────────────────────────────────────────
    // QR CODE GENERATION (Owner)
    // ─────────────────────────────────────────────────────
    async function renderOwnerQRCodes(company) {
        const container = $('#qr-codes-container');
        if (!container) return;
        container.innerHTML = '';

        const BASE_URL = window.location.origin + window.location.pathname;
        const branches = (company.branches && company.branches.length > 0)
            ? company.branches
            : ['Main'];   // If no branches, generate one QR for the whole company

        branches.forEach(branch => {
            // Encode: base URL + params that the scanner will parse
            const qrData = `${BASE_URL}?qr=1&cid=${encodeURIComponent(company.id)}&b=${encodeURIComponent(branch)}`;

            const card = document.createElement('div');
            card.className = 'card glass';
            card.style.cssText = 'padding:20px; text-align:center; min-width:200px; flex:1; max-width:280px;';
            card.innerHTML = `
                <h4 style="margin-bottom:4px;">${branch === 'Main' ? '🏢 Main' : '📍 ' + branch}</h4>
                <p style="color:var(--text-secondary); font-size:11px; margin-bottom:12px;">${company.name}</p>
                <div id="qr-${branch.replace(/\s+/g,'_')}" style="background:white; padding:10px; border-radius:8px; display:inline-block;"></div>
                <p style="color:var(--text-muted); font-size:10px; margin-top:8px; word-break:break-all;">${company.code || ''}</p>
                <button class="btn btn-outline" onclick="window.printQR('${branch.replace(/'/g,"\\'")}', '${company.name.replace(/'/g,"\\'")}', '${qrData.replace(/'/g,"\\'")}' )" style="margin-top:12px; width:100%; font-size:12px;">🖨️ Print</button>
            `;
            container.appendChild(card);

            // Generate QR
            const qrEl = card.querySelector(`#qr-${branch.replace(/\s+/g,'_')}`);
            if (qrEl && window.QRCode) {
                new window.QRCode(qrEl, {
                    text: qrData,
                    width: 160,
                    height: 160,
                    colorDark: '#0f172a',
                    colorLight: '#ffffff',
                    correctLevel: window.QRCode.CorrectLevel.H
                });
            }
        });
    }

    window.printQR = function(branch, companyName, qrData) {
        const win = window.open('', '_blank', 'width=400,height=500');
        win.document.write(`
            <!DOCTYPE html><html><head>
            <title>${companyName} — ${branch} QR</title>
            <style>
                body { font-family: Arial, sans-serif; text-align:center; padding:40px; background:#fff; }
                h2 { margin-bottom:4px; }
                p { color:#666; font-size:13px; margin-bottom:20px; }
                #print-qr { display:inline-block; }
                @media print { button { display:none; } }
            </style>
            </head><body>
            <h2>${companyName}</h2>
            <p>Branch: <strong>${branch}</strong></p>
            <div id="print-qr"></div>
            <p style="margin-top:16px; font-size:11px; color:#999;">Scan to Clock In / Out</p>
            <br><button onclick="window.print()">🖨️ Print</button>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
            <script>
                new QRCode(document.getElementById('print-qr'), {
                    text: '${qrData}',
                    width: 220, height: 220,
                    colorDark:'#000000', colorLight:'#ffffff',
                    correctLevel: QRCode.CorrectLevel.H
                });
                setTimeout(() => window.print(), 800);
            <\/script>
            </body></html>
        `);
        win.document.close();
    };

    // ─────────────────────────────────────────────────────
    // QR CODE SCANNER (Staff)
    // ─────────────────────────────────────────────────────
    let _qrScanner = null;

    function openQRScanner() {
        const modal = $('#modal-qr-scanner');
        modal.style.display = 'flex';
        const statusEl = $('#qr-scan-status');
        statusEl.textContent = 'Initialising camera…';

        if (_qrScanner) {
            try { _qrScanner.clear(); } catch(e) {}
            _qrScanner = null;
        }

        _qrScanner = new Html5Qrcode('qr-reader');
        _qrScanner.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 230, height: 230 } },
            async (decodedText) => {
                // Stop scanning immediately
                try { await _qrScanner.stop(); } catch(e) {}
                modal.style.display = 'none';
                statusEl.textContent = '';
                await handleQRClockAction(decodedText);
            },
            (err) => { /* scanning in progress - ignore frame errors */ }
        ).then(() => {
            statusEl.textContent = 'Camera ready — aim at QR code';
        }).catch(err => {
            statusEl.textContent = '⚠️ Camera access denied. Please allow camera.';
            console.error('QR scanner error:', err);
        });
    }

    function closeQRScanner() {
        const modal = $('#modal-qr-scanner');
        modal.style.display = 'none';
        if (_qrScanner) {
            try { _qrScanner.stop().catch(() => {}); } catch(e) {}
            _qrScanner = null;
        }
    }

    async function handleQRClockAction(qrText) {
        // Parse QR URL params
        let cid, branch;
        try {
            const url = new URL(qrText);
            cid    = url.searchParams.get('cid');
            branch = url.searchParams.get('b');
        } catch(e) {
            toast('Invalid QR code', 'error');
            return;
        }

        if (!cid) { toast('Invalid QR code', 'error'); return; }

        const session = getSession();
        if (!session) { toast('Please log in first', 'error'); return; }

        // Verify staff belongs to this company
        if (session.company_id !== cid) {
            toast('⚠️ This QR code belongs to a different company', 'error');
            return;
        }

        // Check for active entry
        const { data: active } = await sb
            .from('time_entries')
            .select('*')
            .eq('user_id', session.id)
            .is('clock_out', null)
            .maybeSingle();

        if (active) {
            // Clock OUT
            const clockOut = new Date().toISOString();
            await sb.from('time_entries').update({ clock_out: clockOut }).eq('id', active.id);
            clearInterval(elapsedInterval);
            currentActiveEntry = null;
            setClockedInState(false);
            toast(`🔴 Clocked out from ${branch || 'branch'}!`);
        } else {
            // Clock IN
            const { data: entry, error } = await sb.from('time_entries').insert({
                user_id: session.id,
                company_id: session.company_id,
                clock_in: new Date().toISOString(),
                clock_out: null,
                auto_clocked_out: false,
                branch: branch || null
            }).select().single();

            if (error) { toast('Clock in failed: ' + error.message, 'error'); return; }
            currentActiveEntry = entry;
            setClockedInState(true);
            startElapsedTimer(new Date(entry.clock_in));
            toast(`🟢 Clocked in at ${branch || 'branch'}!`);
        }

        const { data: company } = await sb.from('companies').select('*').eq('id', session.company_id).single();
        await renderTodayEntries(session);
        await renderHoursSummary(session, company);
        await renderEarningsSummary(session, company);
    }

    // Attach QR scanner button
    const btnOpenQR = $('#btn-open-qr-scanner');
    if (btnOpenQR) btnOpenQR.addEventListener('click', openQRScanner);

    const btnCloseQR = $('#btn-close-qr-scanner');
    if (btnCloseQR) btnCloseQR.addEventListener('click', closeQRScanner);

    // ─────────────────────────────────────────────────────
    // Handle QR URL params on page load (deep-link from QR)
    // ─────────────────────────────────────────────────────
    async function checkQRParam() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('qr') !== '1') return;
        const cid    = params.get('cid');
        const branch = params.get('b');
        if (!cid) return;

        // Clean the URL
        window.history.replaceState({}, document.title, window.location.pathname);

        // Store for after login
        sessionStorage.setItem('pending_qr_cid', cid);
        sessionStorage.setItem('pending_qr_branch', branch || '');
    }

    async function processPendingQR() {
        const cid    = sessionStorage.getItem('pending_qr_cid');
        const branch = sessionStorage.getItem('pending_qr_branch');
        if (!cid) return;
        sessionStorage.removeItem('pending_qr_cid');
        sessionStorage.removeItem('pending_qr_branch');
        const fakeQR = `${window.location.origin}${window.location.pathname}?qr=1&cid=${encodeURIComponent(cid)}&b=${encodeURIComponent(branch)}`;
        toast('Processing QR clock action…');
        setTimeout(() => handleQRClockAction(fakeQR), 500);
    }

    checkQRParam();

    init();

})();
