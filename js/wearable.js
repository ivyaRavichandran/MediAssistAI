// ===== Wearable Data Simulation Module =====

const WearableSimulator = {
    isRunning: false,
    intervalId: null,
    updateInterval: 3000,
    historyLength: 60,
    startTime: null,

    config: {
        user: {
            age: 35,
            sex: 'male',
            weight: 70,
            height: 170,
            restingHR: 68,
            maxHR: 185,
            baseSpO2: 97,
            baseBP: { sys: 120, dia: 80 },
            baseTemp: 36.5,
            healthProfile: 'normal'
        },
        emergencyThresholds: {
            heartRate: { low: 45, high: 150 },
            spO2: { low: 90 },
            bloodPressure: { sysHigh: 180, sysLow: 85, diaHigh: 120, diaLow: 50 },
            temperature: { low: 35.0, high: 39.5 },
            stressLevel: { high: 90 }
        }
    },

    state: {
        heartRate: 72,
        heartRateHistory: [],
        spO2: 97,
        spO2History: [],
        steps: 0,
        totalStepsToday: 0,
        caloriesBurned: 0,
        distanceKm: 0,
        bloodPressure: { sys: 120, dia: 80 },
        bloodPressureHistory: [],
        temperature: 36.5,
        temperatureHistory: [],
        stressLevel: 35,
        stressHistory: [],
        sleepQuality: 85,
        sleepHours: 7.2,
        sleepStages: [],
        respiratoryRate: 16,
        activeMinutes: 0,
        floors: 0,
        hydration: 60,
        currentActivity: 'resting',
        lastUpdate: null,
        alerts: [],
        emergencyContacts: [],
        isEmergencyMode: false,
        emergencyCooldown: 0
    },

    profiles: {
        normal: {
            hrBase: 68, hrVar: 8, spO2Base: 97, spO2Var: 1,
            sysBase: 120, diaBase: 80, bpVar: 5,
            tempBase: 36.5, tempVar: 0.2,
            stressBase: 30, stressVar: 15
        },
        diabetic: {
            hrBase: 72, hrVar: 10, spO2Base: 96, spO2Var: 2,
            sysBase: 128, diaBase: 82, bpVar: 8,
            tempBase: 36.4, tempVar: 0.3,
            stressBase: 40, stressVar: 20
        },
        hypertensive: {
            hrBase: 74, hrVar: 12, spO2Base: 96, spO2Var: 1.5,
            sysBase: 142, diaBase: 92, bpVar: 12,
            tempBase: 36.5, tempVar: 0.2,
            stressBase: 45, stressVar: 18
        },
        cardiac: {
            hrBase: 65, hrVar: 15, spO2Base: 95, spO2Var: 3,
            sysBase: 118, diaBase: 76, bpVar: 10,
            tempBase: 36.4, tempVar: 0.3,
            stressBase: 50, stressVar: 22
        },
        elderly: {
            hrBase: 70, hrVar: 10, spO2Base: 95, spO2Var: 2,
            sysBase: 135, diaBase: 85, bpVar: 10,
            tempBase: 36.3, tempVar: 0.3,
            stressBase: 35, stressVar: 15
        }
    },

    activities: [
        { name: 'resting', hrMod: 0, stepsRate: 0, calRate: 0.8, stressMod: -5 },
        { name: 'walking', hrMod: 20, stepsRate: 100, calRate: 4.5, stressMod: -10 },
        { name: 'light_exercise', hrMod: 40, stepsRate: 60, calRate: 8, stressMod: -15 },
        { name: 'moderate_exercise', hrMod: 60, stepsRate: 40, calRate: 12, stressMod: -12 },
        { name: 'intense_exercise', hrMod: 80, stepsRate: 30, calRate: 16, stressMod: -8 },
        { name: 'stress', hrMod: 15, stepsRate: 5, calRate: 2, stressMod: 25 },
        { name: 'eating', hrMod: 8, stepsRate: 2, calRate: 1.2, stressMod: -3 },
        { name: 'sleeping', hrMod: -15, stepsRate: 0, calRate: 0.6, stressMod: -20 }
    ],

    init(profile) {
        if (profile && this.profiles[profile]) {
            this.config.user.healthProfile = profile;
        }
        const p = this.profiles[this.config.user.healthProfile];
        this.config.user.restingHR = p.hrBase;

        const saved = JSON.parse(localStorage.getItem('mediassist_wearable') || '{}');
        if (saved.emergencyContacts) {
            this.state.emergencyContacts = saved.emergencyContacts;
        }
        if (saved.totalStepsToday !== undefined) {
            this.state.totalStepsToday = saved.totalStepsToday;
        }

        this.startTime = Date.now();
        this.seedInitialHistory();
        this.generateSleepStages();
    },

    seedInitialHistory() {
        const now = Date.now();
        for (let i = this.historyLength; i >= 0; i--) {
            const time = new Date(now - i * this.updateInterval);
            const hour = time.getHours();
            const noise = () => (Math.random() - 0.5) * 2;
            const circadian = this.getCircadianModifier(hour);
            const p = this.profiles[this.config.user.healthProfile];

            this.state.heartRateHistory.push({
                value: Math.round(p.hrBase + circadian.hr * p.hrVar + noise() * 3),
                time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                timestamp: time.getTime()
            });
            this.state.spO2History.push({
                value: Math.max(88, Math.min(100, Math.round(p.spO2Base + noise() * p.spO2Var + circadian.spO2 * 0.5))),
                time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                timestamp: time.getTime()
            });
            const sysNoise = Math.round(noise() * p.bpVar);
            const diaNoise = Math.round(noise() * (p.bpVar * 0.6));
            this.state.bloodPressureHistory.push({
                sys: Math.round(p.sysBase + circadian.bp * p.bpVar + sysNoise),
                dia: Math.round(p.diaBase + circadian.bp * (p.bpVar * 0.6) + diaNoise),
                time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                timestamp: time.getTime()
            });
            this.state.temperatureHistory.push({
                value: +(p.tempBase + circadian.temp * p.tempVar + noise() * 0.1).toFixed(1),
                time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                timestamp: time.getTime()
            });
            this.state.stressHistory.push({
                value: Math.max(0, Math.min(100, Math.round(p.stressBase + circadian.stress * p.stressVar + noise() * 5))),
                time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                timestamp: time.getTime()
            });
        }
    },

    getCircadianModifier(hour) {
        const t = hour / 24;
        return {
            hr: Math.sin((t - 0.25) * 2 * Math.PI) * 0.4,
            spO2: -Math.cos((t - 0.5) * 2 * Math.PI) * 0.3,
            bp: Math.sin((t - 0.3) * 2 * Math.PI) * 0.5,
            temp: Math.sin((t - 0.5) * 2 * Math.PI) * 0.6,
            stress: Math.sin((t - 0.75) * 2 * Math.PI) * 0.7
        };
    },

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.intervalId = setInterval(() => this.tick(), this.updateInterval);
        this.tick();
        this.updateUI();
    },

    stop() {
        if (!this.isRunning) return;
        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    },

    tick() {
        if (this.emergencyCooldown > 0) this.emergencyCooldown--;

        this.evolveActivity();
        const hour = new Date().getHours();
        const circadian = this.getCircadianModifier(hour);
        const p = this.profiles[this.config.user.healthProfile];
        const activity = this.getCurrentActivity();
        const noise = () => (Math.random() - 0.5) * 2;
        const smoothNoise = (prev, target, factor) => prev + (target - prev) * factor + noise() * (1 - factor) * 0.3;

        const hrTarget = p.hrBase + circadian.hr * p.hrVar + activity.hrMod + noise() * 3;
        this.state.heartRate = Math.max(40, Math.min(200, Math.round(smoothNoise(this.state.heartRate, hrTarget, 0.3))));
        this.state.heartRateHistory.push({
            value: this.state.heartRate,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: Date.now()
        });
        if (this.state.heartRateHistory.length > this.historyLength) this.state.heartRateHistory.shift();

        const spO2Target = p.spO2Base + circadian.spO2 * p.spO2Var / 2 + noise() * 0.5;
        this.state.spO2 = Math.max(85, Math.min(100, Math.round(smoothNoise(this.state.spO2, spO2Target, 0.2))));
        this.state.spO2History.push({
            value: this.state.spO2,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: Date.now()
        });
        if (this.state.spO2History.length > this.historyLength) this.state.spO2History.shift();

        const sysTarget = p.sysBase + circadian.bp * p.bpVar + activity.stressMod * 0.3 + noise() * 4;
        const diaTarget = p.diaBase + circadian.bp * p.bpVar * 0.6 + activity.stressMod * 0.2 + noise() * 3;
        this.state.bloodPressure = {
            sys: Math.max(70, Math.min(200, Math.round(smoothNoise(this.state.bloodPressure.sys, sysTarget, 0.15)))),
            dia: Math.max(40, Math.min(130, Math.round(smoothNoise(this.state.bloodPressure.dia, diaTarget, 0.15))))
        };
        this.state.bloodPressureHistory.push({
            sys: this.state.bloodPressure.sys,
            dia: this.state.bloodPressure.dia,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: Date.now()
        });
        if (this.state.bloodPressureHistory.length > this.historyLength) this.state.bloodPressureHistory.shift();

        const tempTarget = p.tempBase + circadian.temp * p.tempVar + (activity.name === 'intense_exercise' ? 0.8 : 0) + noise() * 0.1;
        this.state.temperature = +(smoothNoise(this.state.temperature, tempTarget, 0.1)).toFixed(1);
        this.state.temperature = Math.max(34, Math.min(42, this.state.temperature));
        this.state.temperatureHistory.push({
            value: this.state.temperature,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: Date.now()
        });
        if (this.state.temperatureHistory.length > this.historyLength) this.state.temperatureHistory.shift();

        const stressTarget = Math.max(0, Math.min(100, p.stressBase + circadian.stress * p.stressVar + activity.stressMod + noise() * 8));
        this.state.stressLevel = Math.max(0, Math.min(100, Math.round(smoothNoise(this.state.stressLevel, stressTarget, 0.1))));
        this.state.stressHistory.push({
            value: this.state.stressLevel,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: Date.now()
        });
        if (this.state.stressHistory.length > this.historyLength) this.state.stressHistory.shift();

        this.state.respiratoryRate = Math.max(10, Math.min(28, Math.round(14 + circadian.hr * 3 + (activity.hrMod > 40 ? activity.hrMod / 15 : 0) + noise())));

        this.state.steps += activity.stepsRate;
        this.state.totalStepsToday += activity.stepsRate;
        this.state.caloriesBurned = +(this.state.totalStepsToday * 0.04 + (activity.calRate * this.state.totalStepsToday / 800)).toFixed(1);
        this.state.distanceKm = +(this.state.totalStepsToday * 0.000762).toFixed(2);
        this.state.activeMinutes += activity.hrMod > 15 ? 1 : 0;
        this.state.floors = Math.floor(this.state.totalStepsToday / 1500);

        this.state.hydration = Math.max(20, Math.min(100, this.state.hydration - 0.05 + (activity.name === 'intense_exercise' ? -0.1 : 0)));
        this.state.currentActivity = activity.name;
        this.state.lastUpdate = new Date().toISOString();

        this.checkEmergencies();
        this.updateUI();
        this.saveWearableData();
    },

    evolveActivity() {
        const hour = new Date().getHours();
        const minute = new Date().getMinutes();
        const t = hour + minute / 60;

        let possibleActivities;
        if (t >= 23 || t < 6) {
            possibleActivities = ['sleeping', 'sleeping', 'sleeping', 'resting'];
        } else if (t >= 6 && t < 7) {
            possibleActivities = ['resting', 'light_exercise', 'walking'];
        } else if (t >= 7 && t < 9) {
            possibleActivities = ['walking', 'light_exercise', 'moderate_exercise'];
        } else if (t >= 9 && t < 12) {
            possibleActivities = ['resting', 'walking', 'stress', 'eating'];
        } else if (t >= 12 && t < 13) {
            possibleActivities = ['eating', 'resting', 'walking'];
        } else if (t >= 13 && t < 17) {
            possibleActivities = ['resting', 'walking', 'stress', 'light_exercise'];
        } else if (t >= 17 && t < 19) {
            possibleActivities = ['moderate_exercise', 'intense_exercise', 'light_exercise', 'walking'];
        } else if (t >= 19 && t < 21) {
            possibleActivities = ['resting', 'eating', 'walking'];
        } else {
            possibleActivities = ['resting', 'resting', 'walking'];
        }

        if (Math.random() < 0.15) {
            const randomIdx = Math.floor(Math.random() * possibleActivities.length);
            this.state.currentActivity = possibleActivities[randomIdx];
        }
    },

    getCurrentActivity() {
        return this.activities.find(a => a.name === this.state.currentActivity) || this.activities[0];
    },

    generateSleepStages() {
        const stages = [];
        const totalMinutes = 420;
        let minute = 0;
        while (minute < totalMinutes) {
            const stageRand = Math.random();
            let stage, duration;
            if (minute < 30) {
                stage = 'awake';
                duration = 5 + Math.floor(Math.random() * 10);
            } else if (stageRand < 0.15) {
                stage = 'deep';
                duration = 20 + Math.floor(Math.random() * 40);
            } else if (stageRand < 0.4) {
                stage = 'rem';
                duration = 15 + Math.floor(Math.random() * 30);
            } else if (stageRand < 0.75) {
                stage = 'light';
                duration = 10 + Math.floor(Math.random() * 25);
            } else {
                stage = 'awake';
                duration = 2 + Math.floor(Math.random() * 8);
            }
            stages.push({ stage, duration, startMinute: minute });
            minute += duration;
        }
        this.state.sleepStages = stages;
        this.state.sleepHours = +(totalMinutes / 60).toFixed(1);
        this.state.sleepQuality = Math.round(60 + Math.random() * 30);
    },

    checkEmergencies() {
        if (this.emergencyCooldown > 0) return;

        const th = this.config.emergencyThresholds;
        const alerts = [];

        if (this.state.heartRate > th.heartRate.high) {
            alerts.push({
                type: 'critical',
                metric: 'Heart Rate',
                value: this.state.heartRate,
                threshold: th.heartRate.high,
                message: `Dangerously high heart rate: ${this.state.heartRate} BPM`,
                timestamp: Date.now()
            });
        } else if (this.state.heartRate < th.heartRate.low) {
            alerts.push({
                type: 'critical',
                metric: 'Heart Rate',
                value: this.state.heartRate,
                threshold: th.heartRate.low,
                message: `Dangerously low heart rate: ${this.state.heartRate} BPM`,
                timestamp: Date.now()
            });
        }

        if (this.state.spO2 < th.spO2.low) {
            alerts.push({
                type: 'critical',
                metric: 'SpO2',
                value: this.state.spO2,
                threshold: th.spO2.low,
                message: `Critical oxygen level: ${this.state.spO2}%`,
                timestamp: Date.now()
            });
        }

        if (this.state.bloodPressure.sys > th.bloodPressure.sysHigh) {
            alerts.push({
                type: 'critical',
                metric: 'Blood Pressure',
                value: `${this.state.bloodPressure.sys}/${this.state.bloodPressure.dia}`,
                threshold: `>${th.bloodPressure.sysHigh}`,
                message: `Hypertensive crisis: ${this.state.bloodPressure.sys}/${this.state.bloodPressure.dia} mmHg`,
                timestamp: Date.now()
            });
        } else if (this.state.bloodPressure.sys < th.bloodPressure.sysLow) {
            alerts.push({
                type: 'critical',
                metric: 'Blood Pressure',
                value: `${this.state.bloodPressure.sys}/${this.state.bloodPressure.dia}`,
                threshold: `<${th.bloodPressure.sysLow}`,
                message: `Hypotension detected: ${this.state.bloodPressure.sys}/${this.state.bloodPressure.dia} mmHg`,
                timestamp: Date.now()
            });
        }

        if (this.state.temperature > th.temperature.high) {
            alerts.push({
                type: 'warning',
                metric: 'Temperature',
                value: this.state.temperature,
                threshold: th.temperature.high,
                message: `High fever detected: ${this.state.temperature}°C`,
                timestamp: Date.now()
            });
        } else if (this.state.temperature < th.temperature.low) {
            alerts.push({
                type: 'warning',
                metric: 'Temperature',
                value: this.state.temperature,
                threshold: th.temperature.low,
                message: `Low body temperature: ${this.state.temperature}°C`,
                timestamp: Date.now()
            });
        }

        if (alerts.length > 0) {
            const criticals = alerts.filter(a => a.type === 'critical');
            if (criticals.length > 0) {
                this.triggerEmergency(criticals);
            }
            alerts.forEach(a => {
                this.state.alerts.push(a);
                if (this.state.alerts.length > 50) this.state.alerts.shift();
            });
        }
    },

    triggerEmergency(alerts) {
        this.state.isEmergencyMode = true;
        this.emergencyCooldown = 30;

        const alertMsg = alerts.map(a => a.message).join('; ');

        if (Notification.permission === 'granted') {
            new Notification('MediAssist AI - EMERGENCY ALERT', {
                body: `Health emergency detected! ${alertMsg}`,
                icon: 'assets/images/icon.png',
                vibrate: [500, 200, 500, 200, 500],
                tag: 'medassist-emergency',
                requireInteraction: true
            });
        }

        this.state.emergencyContacts.forEach(contact => {
            if (Notification.permission === 'granted') {
                new Notification(`Emergency: Health Alert for ${App.currentUser?.name || 'User'}`, {
                    body: `${alertMsg}. Please check immediately!`,
                    tag: `emergency-${contact.phone}`
                });
            }
        });

        App.addHistory('warning', 'Emergency Alert', alertMsg);
        App.saveData();

        this.showEmergencyOverlay(alerts);

        setTimeout(() => {
            this.state.isEmergencyMode = false;
        }, 60000);
    },

    showEmergencyOverlay(alerts) {
        const overlay = document.getElementById('emergency-overlay');
        if (!overlay) return;

        const details = document.getElementById('emergency-details');
        if (details) {
            details.innerHTML = alerts.map(a => `
                <div class="emergency-alert-item">
                    <strong>${a.metric}:</strong> ${a.value}
                    <p>${a.message}</p>
                </div>
            `).join('');
        }

        overlay.classList.remove('hidden');
        setTimeout(() => {
            overlay.classList.add('hidden');
            this.state.isEmergencyMode = false;
        }, 15000);
    },

    dismissEmergency() {
        const overlay = document.getElementById('emergency-overlay');
        if (overlay) overlay.classList.add('hidden');
        this.state.isEmergencyMode = false;
    },

    addEmergencyContact(name, phone, relation) {
        const contact = { id: generateId(), name, phone, relation, addedDate: new Date().toISOString() };
        this.state.emergencyContacts.push(contact);
        this.saveWearableData();
        showToast(`Emergency contact ${name} added`);
        return contact;
    },

    removeEmergencyContact(id) {
        this.state.emergencyContacts = this.state.emergencyContacts.filter(c => c.id !== id);
        this.saveWearableData();
        showToast('Emergency contact removed');
    },

    getHealthScore() {
        let score = 100;
        const th = this.config.emergencyThresholds;

        const hrDeviation = Math.abs(this.state.heartRate - this.config.user.restingHR);
        if (hrDeviation > 40) score -= 15;
        else if (hrDeviation > 25) score -= 8;
        else if (hrDeviation > 15) score -= 3;

        if (this.state.spO2 < 92) score -= 25;
        else if (this.state.spO2 < 95) score -= 10;
        else if (this.state.spO2 < 97) score -= 3;

        if (this.state.bloodPressure.sys > 160 || this.state.bloodPressure.sys < 90) score -= 20;
        else if (this.state.bloodPressure.sys > 140 || this.state.bloodPressure.sys < 100) score -= 8;

        if (this.state.stressLevel > 80) score -= 15;
        else if (this.state.stressLevel > 60) score -= 5;

        if (this.state.temperature > 38.5) score -= 15;
        else if (this.state.temperature > 37.5) score -= 5;

        if (this.state.totalStepsToday < 3000) score -= 10;
        else if (this.state.totalStepsToday < 6000) score -= 3;

        return Math.max(0, Math.min(100, Math.round(score)));
    },

    getHeartRateZone() {
        const hr = this.state.heartRate;
        const maxHR = this.config.user.maxHR;
        const percent = (hr / maxHR) * 100;

        if (percent < 50) return { zone: 'Rest', color: '#90a4ae' };
        if (percent < 60) return { zone: 'Fat Burn', color: '#66bb6a' };
        if (percent < 70) return { zone: 'Cardio', color: '#ffa726' };
        if (percent < 80) return { zone: 'Peak', color: '#ef5350' };
        return { zone: 'Maximum', color: '#b71c1c' };
    },

    getStressLabel() {
        const s = this.state.stressLevel;
        if (s < 25) return { label: 'Very Low', color: '#66bb6a' };
        if (s < 40) return { label: 'Low', color: '#81c784' };
        if (s < 55) return { label: 'Moderate', color: '#ffa726' };
        if (s < 70) return { label: 'High', color: '#ef5350' };
        return { label: 'Very High', color: '#b71c1c' };
    },

    getBPStatus() {
        const sys = this.state.bloodPressure.sys;
        const dia = this.state.bloodPressure.dia;
        if (sys < 90 || dia < 60) return { label: 'Low', color: '#42a5f5' };
        if (sys <= 120 && dia <= 80) return { label: 'Normal', color: '#66bb6a' };
        if (sys <= 139 || dia <= 89) return { label: 'Elevated', color: '#ffa726' };
        if (sys <= 159 || dia <= 99) return { label: 'High (Stage 1)', color: '#ef5350' };
        return { label: 'High (Stage 2)', color: '#b71c1c' };
    },

    formatSleepStage(stage) {
        const labels = {
            awake: { label: 'Awake', color: '#ef5350', icon: 'fa-eye' },
            rem: { label: 'REM', color: '#7e57c2', icon: 'fa-brain' },
            light: { label: 'Light', color: '#42a5f5', icon: 'fa-cloud' },
            deep: { label: 'Deep', color: '#1565c0', icon: 'fa-moon' }
        };
        return labels[stage] || labels.awake;
    },

    saveWearableData() {
        localStorage.setItem('mediassist_wearable', JSON.stringify({
            totalStepsToday: this.state.totalStepsToday,
            emergencyContacts: this.state.emergencyContacts,
            lastDate: new Date().toISOString().split('T')[0]
        }));
    },

    updateUI() {
        this.updateMetricDisplay();
        this.updateGraphs();
        this.updateHealthScore();
        this.updateAlerts();
        this.updateEmergencyContacts();
    },

    updateMetricDisplay() {
        const hr = document.getElementById('wl-heart-rate');
        const spo2 = document.getElementById('wl-spo2');
        const steps = document.getElementById('wl-steps');
        const bp = document.getElementById('wl-bp');
        const temp = document.getElementById('wl-temp');
        const stress = document.getElementById('wl-stress');
        const resp = document.getElementById('wl-resp');
        const activity = document.getElementById('wl-activity');
        const calories = document.getElementById('wl-calories');
        const distance = document.getElementById('wl-distance');
        const activeMin = document.getElementById('wl-active-min');
        const floors = document.getElementById('wl-floors');
        const hydration = document.getElementById('wl-hydration');
        const sleep = document.getElementById('wl-sleep');
        const sleepQuality = document.getElementById('wl-sleep-quality');

        if (hr) {
            const zone = this.getHeartRateZone();
            hr.textContent = this.state.heartRate;
            const hrUnit = hr.nextElementSibling;
            if (hrUnit) hrUnit.textContent = 'BPM';
            const zoneEl = document.getElementById('wl-hr-zone');
            if (zoneEl) {
                zoneEl.textContent = zone.zone;
                zoneEl.style.color = zone.color;
            }
        }
        if (spo2) spo2.textContent = this.state.spO2 + '%';
        if (steps) steps.textContent = this.state.totalStepsToday.toLocaleString();
        if (bp) bp.textContent = `${this.state.bloodPressure.sys}/${this.state.bloodPressure.dia}`;
        if (temp) temp.textContent = this.state.temperature + '°C';

        if (stress) {
            const stressInfo = this.getStressLabel();
            stress.textContent = this.state.stressLevel;
            const stressLabel = document.getElementById('wl-stress-label');
            if (stressLabel) {
                stressLabel.textContent = stressInfo.label;
                stressLabel.style.color = stressInfo.color;
            }
        }

        if (resp) resp.textContent = this.state.respiratoryRate + '/min';
        if (activity) activity.textContent = this.state.currentActivity.replace('_', ' ');
        if (calories) calories.textContent = this.state.caloriesBurned;
        if (distance) distance.textContent = this.state.distanceKm + ' km';
        if (activeMin) activeMin.textContent = this.state.activeMinutes;
        if (floors) floors.textContent = this.state.floors;

        if (hydration) {
            hydration.style.width = this.state.hydration + '%';
        }
        const hydrationPct = document.getElementById('wl-hydration-pct');
        if (hydrationPct) hydrationPct.textContent = Math.round(this.state.hydration) + '%';

        if (sleep) sleep.textContent = this.state.sleepHours + 'h';
        if (sleepQuality) sleepQuality.textContent = this.state.sleepQuality + '%';

        const bpStatus = document.getElementById('wl-bp-status');
        if (bpStatus) {
            const status = this.getBPStatus();
            bpStatus.textContent = status.label;
            bpStatus.style.color = status.color;
        }

        const statusDot = document.getElementById('wl-status-dot');
        if (statusDot) {
            const score = this.getHealthScore();
            if (score >= 80) statusDot.className = 'wl-status-dot good';
            else if (score >= 60) statusDot.className = 'wl-status-dot fair';
            else statusDot.className = 'wl-status-dot poor';
        }
    },

    updateGraphs() {
        this.drawLineGraph('wl-hr-graph', this.state.heartRateHistory.map(h => h.value), {
            min: 40, max: 180, color: '#ef5350', fillColor: 'rgba(239,83,80,0.1)',
            thresholdLow: this.config.emergencyThresholds.heartRate.low,
            thresholdHigh: this.config.emergencyThresholds.heartRate.high
        });

        this.drawLineGraph('wl-spo2-graph', this.state.spO2History.map(h => h.value), {
            min: 85, max: 100, color: '#42a5f5', fillColor: 'rgba(66,165,245,0.1)',
            thresholdLow: this.config.emergencyThresholds.spO2.low
        });

        this.drawBPGraph('wl-bp-graph', this.state.bloodPressureHistory);

        this.drawLineGraph('wl-stress-graph', this.state.stressHistory.map(h => h.value), {
            min: 0, max: 100, color: '#ffa726', fillColor: 'rgba(255,167,38,0.1)',
            thresholdHigh: this.config.emergencyThresholds.stressLevel.high
        });

        this.drawLineGraph('wl-temp-graph', this.state.temperatureHistory.map(h => h.value), {
            min: 35, max: 40, color: '#66bb6a', fillColor: 'rgba(102,187,106,0.1)',
            thresholdLow: this.config.emergencyThresholds.temperature.low,
            thresholdHigh: this.config.emergencyThresholds.temperature.high
        });

        this.drawSleepGraph('wl-sleep-graph', this.state.sleepStages);
    },

    drawLineGraph(canvasId, data, options) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width = canvas.parentElement.offsetWidth;
        const H = canvas.height = 120;

        ctx.clearRect(0, 0, W, H);

        if (data.length < 2) return;

        const padding = { top: 10, right: 10, bottom: 10, left: 10 };
        const graphW = W - padding.left - padding.right;
        const graphH = H - padding.top - padding.bottom;

        const min = options.min !== undefined ? options.min : Math.min(...data) - 5;
        const max = options.max !== undefined ? options.max : Math.max(...data) + 5;
        const range = max - min || 1;

        if (options.thresholdHigh !== undefined) {
            const y = padding.top + graphH - ((options.thresholdHigh - min) / range) * graphH;
            ctx.strokeStyle = 'rgba(239,83,80,0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(W - padding.right, y);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        if (options.thresholdLow !== undefined) {
            const y = padding.top + graphH - ((options.thresholdLow - min) / range) * graphH;
            ctx.strokeStyle = 'rgba(66,165,245,0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(W - padding.right, y);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.beginPath();
        data.forEach((val, i) => {
            const x = padding.left + (i / (data.length - 1)) * graphW;
            const y = padding.top + graphH - ((val - min) / range) * graphH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = options.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        const lastX = padding.left + graphW;
        const lastY = padding.top + graphH - ((data[data.length - 1] - min) / range) * graphH;
        ctx.beginPath();
        ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
        ctx.fillStyle = options.color;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        data.forEach((val, i) => {
            const x = padding.left + (i / (data.length - 1)) * graphW;
            const y = padding.top + graphH - ((val - min) / range) * graphH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.lineTo(padding.left + graphW, padding.top + graphH);
        ctx.lineTo(padding.left, padding.top + graphH);
        ctx.closePath();
        const gradient = ctx.createLinearGradient(0, 0, 0, H);
        gradient.addColorStop(0, options.fillColor);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fill();
    },

    drawBPGraph(canvasId, history) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width = canvas.parentElement.offsetWidth;
        const H = canvas.height = 120;

        ctx.clearRect(0, 0, W, H);
        if (history.length < 2) return;

        const padding = { top: 10, right: 10, bottom: 10, left: 10 };
        const graphW = W - padding.left - padding.right;
        const graphH = H - padding.top - padding.bottom;

        const allSys = history.map(h => h.sys);
        const allDia = history.map(h => h.dia);
        const min = Math.min(...allDia) - 5;
        const max = Math.max(...allSys) + 5;
        const range = max - min || 1;

        const sysThreshY = padding.top + graphH - ((140 - min) / range) * graphH;
        ctx.strokeStyle = 'rgba(239,83,80,0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(padding.left, sysThreshY);
        ctx.lineTo(W - padding.right, sysThreshY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        history.forEach((h, i) => {
            const x = padding.left + (i / (history.length - 1)) * graphW;
            const y = padding.top + graphH - ((h.sys - min) / range) * graphH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = '#ef5350';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        history.forEach((h, i) => {
            const x = padding.left + (i / (history.length - 1)) * graphW;
            const y = padding.top + graphH - ((h.dia - min) / range) * graphH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = '#42a5f5';
        ctx.lineWidth = 2;
        ctx.stroke();

        const lastSysX = padding.left + graphW;
        const lastSysY = padding.top + graphH - ((history[history.length - 1].sys - min) / range) * graphH;
        ctx.beginPath();
        ctx.arc(lastSysX, lastSysY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ef5350';
        ctx.fill();

        const lastDiaY = padding.top + graphH - ((history[history.length - 1].dia - min) / range) * graphH;
        ctx.beginPath();
        ctx.arc(lastSysX, lastDiaY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#42a5f5';
        ctx.fill();
    },

    drawSleepGraph(canvasId, stages) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width = canvas.parentElement.offsetWidth;
        const H = canvas.height = 80;

        ctx.clearRect(0, 0, W, H);
        if (stages.length === 0) return;

        const totalMin = stages[stages.length - 1].startMinute + stages[stages.length - 1].duration;
        const barH = 24;
        const y = (H - barH) / 2;
        let x = 0;

        stages.forEach(s => {
            const w = (s.duration / totalMin) * W;
            const info = this.formatSleepStage(s.stage);
            ctx.fillStyle = info.color;
            ctx.fillRect(x, y, w, barH);
            x += w;
        });
    },

    updateHealthScore() {
        const score = this.getHealthScore();
        const scoreEl = document.getElementById('wl-health-score');
        const scoreBar = document.getElementById('wl-score-bar');
        if (scoreEl) scoreEl.textContent = score;
        if (scoreBar) {
            scoreBar.style.width = score + '%';
            if (score >= 80) scoreBar.style.background = 'linear-gradient(90deg, #66bb6a, #43a047)';
            else if (score >= 60) scoreBar.style.background = 'linear-gradient(90deg, #ffa726, #f57c00)';
            else scoreBar.style.background = 'linear-gradient(90deg, #ef5350, #d32f2f)';
        }
    },

    updateAlerts() {
        const container = document.getElementById('wl-alerts');
        if (!container) return;

        const recentAlerts = this.state.alerts.slice(-5).reverse();
        if (recentAlerts.length === 0) {
            container.innerHTML = '<p class="empty-state" style="padding: 1rem;">No alerts</p>';
            return;
        }

        container.innerHTML = recentAlerts.map(a => {
            const time = new Date(a.timestamp);
            const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = time.toLocaleDateString();
            return `
                <div class="wl-alert-item ${a.type}">
                    <div class="wl-alert-icon">
                        <i class="fas ${a.type === 'critical' ? 'fa-exclamation-circle' : 'fa-exclamation-triangle'}"></i>
                    </div>
                    <div class="wl-alert-info">
                        <strong>${a.metric}</strong>
                        <p>${a.message}</p>
                        <small>${dateStr} ${timeStr}</small>
                    </div>
                </div>
            `;
        }).join('');
    },

    updateEmergencyContacts() {
        const container = document.getElementById('wl-emergency-contacts');
        if (!container) return;

        if (this.state.emergencyContacts.length === 0) {
            container.innerHTML = '<p class="empty-state" style="padding: 0.5rem;">No emergency contacts set</p>';
            return;
        }

        container.innerHTML = this.state.emergencyContacts.map(c => `
            <div class="wl-contact-item">
                <div class="wl-contact-info">
                    <strong>${c.name}</strong>
                    <span>${c.relation} - ${c.phone}</span>
                </div>
                <button class="btn-icon" onclick="removeEmergencyContactWearable('${c.id}')" title="Remove">
                    <i class="fas fa-trash" style="color: var(--danger); font-size: 0.85rem;"></i>
                </button>
            </div>
        `).join('');
    },

    updateSleepStagesDisplay() {
        const container = document.getElementById('wl-sleep-stages');
        if (!container) return;

        const stageCounts = {};
        this.state.sleepStages.forEach(s => {
            if (!stageCounts[s.stage]) stageCounts[s.stage] = 0;
            stageCounts[s.stage] += s.duration;
        });

        container.innerHTML = Object.entries(stageCounts).map(([stage, min]) => {
            const info = this.formatSleepStage(stage);
            return `
                <div class="wl-sleep-stage-item">
                    <div class="wl-sleep-stage-bar" style="background: ${info.color}; width: ${(min / (this.state.sleepHours * 60)) * 100}%;"></div>
                    <span class="wl-sleep-stage-label"><i class="fas ${info.icon}"></i> ${info.label}</span>
                    <span class="wl-sleep-stage-time">${Math.round(min / 60 * 10) / 10}h</span>
                </div>
            `;
        }).join('');
    }
};

// ===== UI Controller Functions =====

function toggleWearableSimulator() {
    if (WearableSimulator.isRunning) {
        WearableSimulator.stop();
        document.getElementById('wl-toggle-btn').innerHTML = '<i class="fas fa-play"></i> Start Simulation';
        showToast('Wearable simulation paused');
    } else {
        WearableSimulator.start();
        document.getElementById('wl-toggle-btn').innerHTML = '<i class="fas fa-pause"></i> Pause Simulation';
        showToast('Wearable simulation started');
    }
}

function setWearableProfile(profile) {
    WearableSimulator.stop();
    WearableSimulator.init(profile);
    WearableSimulator.start();
    localStorage.setItem('mediassist_wearable', JSON.stringify({
        ...JSON.parse(localStorage.getItem('mediassist_wearable') || '{}'),
        profile: profile
    }));
    document.getElementById('wl-toggle-btn').innerHTML = '<i class="fas fa-pause"></i> Pause Simulation';
    showToast(`Health profile set to: ${profile}`);
}

function simulateEmergency(type) {
    const saved = { ...WearableSimulator.state };
    const th = WearableSimulator.config.emergencyThresholds;

    switch (type) {
        case 'high_hr':
            WearableSimulator.state.heartRate = th.heartRate.high + 15;
            break;
        case 'low_hr':
            WearableSimulator.state.heartRate = th.heartRate.low - 5;
            break;
        case 'low_spo2':
            WearableSimulator.state.spO2 = th.spO2.low - 3;
            break;
        case 'high_bp':
            WearableSimulator.state.bloodPressure = { sys: th.bloodPressure.sysHigh + 10, dia: th.bloodPressure.diaHigh + 5 };
            break;
        case 'high_temp':
            WearableSimulator.state.temperature = th.temperature.high + 0.8;
            break;
    }

    WearableSimulator.checkEmergencies();
    WearableSimulator.updateUI();
}

function showAddEmergencyContactModal() {
    document.getElementById('add-emergency-contact-modal').classList.remove('hidden');
}

function addEmergencyContactFromForm(e) {
    e.preventDefault();
    const name = document.getElementById('ec-name').value.trim();
    const phone = document.getElementById('ec-phone').value.trim();
    const relation = document.getElementById('ec-relation').value;

    if (!name || !phone) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    WearableSimulator.addEmergencyContact(name, phone, relation);
    WearableSimulator.updateEmergencyContacts();
    closeModal('add-emergency-contact-modal');
    document.getElementById('add-emergency-contact-modal').querySelector('form').reset();
}

function removeEmergencyContactWearable(id) {
    WearableSimulator.removeEmergencyContact(id);
    WearableSimulator.updateEmergencyContacts();
}

function dismissEmergencyOverlay() {
    WearableSimulator.dismissEmergency();
}

// ===== Init on App Show =====
function initWearablePage() {
    const saved = JSON.parse(localStorage.getItem('mediassist_wearable') || '{}');
    if (!WearableSimulator.isRunning) {
        WearableSimulator.init(saved.profile || 'normal');
        WearableSimulator.start();
        document.getElementById('wl-toggle-btn').innerHTML = '<i class="fas fa-pause"></i> Pause Simulation';
    }
    WearableSimulator.updateUI();
    WearableSimulator.updateSleepStagesDisplay();
}
