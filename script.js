// 전역 변수
let macroData = {
    macros: {},
    missions: {}
};

let currentMacroKey = null;

// localStorage 키
const STORAGE_KEY = 'ffxiv_macro_data';

// 초기화
document.addEventListener('DOMContentLoaded', function() {
    // 캐시된 데이터 로드
    loadCachedData();
    
    // 이벤트 리스너 등록
    registerEventListeners();
    
    // 초기 테이블 로드
    refreshMacroTable();
    refreshMissionTable();
    
    // 페이지 언로드 시 자동 저장
    window.addEventListener('beforeunload', function() {
        saveToCacheQuiet();
    });
});

// 이벤트 리스너 등록
function registerEventListeners() {
    // 검색 필드에서 엔터키
    document.getElementById('searchProgress').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') searchMacros();
    });
    
    document.getElementById('searchMaxQuality').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') searchMacros();
    });
    
    // 정렬 변경 시 테이블 새로고침
    document.getElementById('sortBy').addEventListener('change', refreshMacroTable);
    
    // 매크로 생성 탭의 입력 필드에서 엔터키
    const inputFields = ['inputProgress', 'inputMaxQuality', 'inputInitialQuality', 'inputDurability'];
    inputFields.forEach(fieldId => {
        document.getElementById(fieldId).addEventListener('keypress', function(e) {
            if (e.key === 'Enter') loadMacro();
        });
    });
    
    // Ctrl+S로 저장
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            saveMacro();
        }
    });
}

// 캐시된 데이터 로드
function loadCachedData() {
    try {
        const cachedData = localStorage.getItem(STORAGE_KEY);
        if (cachedData) {
            const parsed = JSON.parse(cachedData);
            macroData = {
                macros: parsed.macros || {},
                missions: parsed.missions || {}
            };
            console.log('캐시된 데이터를 로드했습니다.', {
                macros: Object.keys(macroData.macros).length,
                missions: Object.keys(macroData.missions).length
            });
            
            // 데이터가 있으면 알림 표시
            if (Object.keys(macroData.macros).length > 0) {
                setTimeout(() => {
                    showAlert(`캐시된 데이터를 불러왔습니다. (매크로 ${Object.keys(macroData.macros).length}개, 임무 ${Object.keys(macroData.missions).length}개)`, 'info');
                }, 500);
            }
        } else {
            // 캐시된 데이터가 없으면 빈 데이터로 초기화
            macroData = {
                macros: {},
                missions: {}
            };
            console.log('캐시된 데이터가 없습니다. 빈 데이터로 초기화했습니다.');
        }
    } catch (error) {
        console.error('캐시된 데이터 로드 실패:', error);
        macroData = {
            macros: {},
            missions: {}
        };
        showAlert('캐시된 데이터를 불러오는데 실패했습니다. 빈 데이터로 시작합니다.', 'warning');
    }
}

// 데이터 캐시에 저장
function saveToCache() {
    try {
        const dataToSave = {
            macros: macroData.macros,
            missions: macroData.missions,
            savedAt: new Date().toISOString()
        };
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
        console.log('데이터가 캐시에 저장되었습니다.');
        showAlert('데이터가 자동 저장되었습니다.', 'success');
        
        return true;
    } catch (error) {
        console.error('캐시 저장 실패:', error);
        showAlert('자동 저장에 실패했습니다. 용량 부족일 수 있습니다.', 'warning');
        return false;
    }
}

// 조용히 캐시에 저장 (알림 없음)
function saveToCacheQuiet() {
    try {
        const dataToSave = {
            macros: macroData.macros,
            missions: macroData.missions,
            savedAt: new Date().toISOString()
        };
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
        console.log('데이터가 자동으로 캐시에 저장되었습니다.');
        return true;
    } catch (error) {
        console.error('자동 캐시 저장 실패:', error);
        return false;
    }
}

// 캐시 삭제
function clearCache() {
    try {
        localStorage.removeItem(STORAGE_KEY);
        macroData = {
            macros: {},
            missions: {}
        };
        refreshMacroTable();
        refreshMissionTable();
        showMacroInfo('매크로를 선택하세요');
        showAlert('캐시가 삭제되었습니다.', 'success');
    } catch (error) {
        console.error('캐시 삭제 실패:', error);
        showAlert('캐시 삭제에 실패했습니다.', 'danger');
    }
}

// 캐시 상태 확인
function getCacheInfo() {
    try {
        const cachedData = localStorage.getItem(STORAGE_KEY);
        if (!cachedData) {
            return null;
        }
        
        const parsed = JSON.parse(cachedData);
        const size = new Blob([cachedData]).size;
        
        return {
            macros: Object.keys(parsed.macros || {}).length,
            missions: Object.keys(parsed.missions || {}).length,
            savedAt: parsed.savedAt,
            size: size
        };
    } catch (error) {
        console.error('캐시 정보 조회 실패:', error);
        return null;
    }
}

// 매크로 키 생성
function createMacroKey(progress, maxQuality, initialQuality, durability) {
    return `${progress}-${maxQuality}-${initialQuality}-${durability}`;
}

// 매크로 키 파싱
function parseMacroKey(key) {
    const parts = key.split('-');
    
    // 등급 제거 (A급, B급, C급, D급)
    if (parts.length >= 3 && parts[parts.length - 1].endsWith('급')) {
        parts.pop();
    }
    
    if (parts.length === 4) {
        return {
            progress: parseInt(parts[0]),
            maxQuality: parseInt(parts[1]),
            initialQuality: parseInt(parts[2]),
            durability: parseInt(parts[3])
        };
    } else if (parts.length === 3) {
        // 레거시 형태 (초기품질 없음)
        return {
            progress: parseInt(parts[0]),
            maxQuality: parseInt(parts[1]),
            initialQuality: 0,
            durability: parseInt(parts[2])
        };
    }
    
    throw new Error(`잘못된 키 형식: ${key}`);
}

// 매크로 조회
function getMacro(key) {
    // 직접 키로 조회
    let macroData = macroData.macros[key];
    
    if (!macroData) {
        // 다양한 키 형태로 시도
        try {
            const parsed = parseMacroKey(key);
            const possibleKeys = [
                `${parsed.progress}-${parsed.maxQuality}-${parsed.initialQuality}-${parsed.durability}`,
                `${parsed.progress}-${parsed.maxQuality}-${parsed.initialQuality}-${parsed.durability}-A급`,
                `${parsed.progress}-${parsed.maxQuality}-${parsed.initialQuality}-${parsed.durability}-B급`,
                `${parsed.progress}-${parsed.maxQuality}-${parsed.initialQuality}-${parsed.durability}-C급`,
                `${parsed.progress}-${parsed.maxQuality}-${parsed.initialQuality}-${parsed.durability}-D급`,
                `${parsed.progress}-${parsed.maxQuality}-${parsed.durability}`,
                `${parsed.progress}-${parsed.maxQuality}-${parsed.durability}-A급`,
                `${parsed.progress}-${parsed.maxQuality}-${parsed.durability}-B급`,
                `${parsed.progress}-${parsed.maxQuality}-${parsed.durability}-C급`,
                `${parsed.progress}-${parsed.maxQuality}-${parsed.durability}-D급`
            ];
            
            for (const possibleKey of possibleKeys) {
                if (macroData.macros[possibleKey]) {
                    macroData = macroData.macros[possibleKey];
                    break;
                }
            }
        } catch (e) {
            // 파싱 실패
        }
    }
    
    if (!macroData) {
        return null;
    }
    
    // 레거시 형식 지원
    if (typeof macroData === 'string') {
        return {
            text: macroData,
            food: '',
            memo: ''
        };
    }
    
    return {
        text: macroData.text || '',
        food: macroData.food || '',
        memo: macroData.memo || ''
    };
}

// 매크로 저장
function setMacro(key, text, food = '', memo = '') {
    macroData.macros[key] = {
        text: text,
        food: food,
        memo: memo
    };
    // 자동 캐시 저장
    saveToCacheQuiet();
}

// 매크로 삭제
function deleteMacroData(key) {
    if (macroData.macros[key]) {
        delete macroData.macros[key];
        
        // 연결된 임무도 삭제
        const missionsToDelete = [];
        for (const [missionKey, macroKey] of Object.entries(macroData.missions)) {
            if (macroKey === key) {
                missionsToDelete.push(missionKey);
            }
        }
        
        missionsToDelete.forEach(missionKey => {
            delete macroData.missions[missionKey];
        });
        
        // 자동 캐시 저장
        saveToCacheQuiet();
    }
}

// 모든 매크로 목록 가져오기
function getAllMacros() {
    const result = [];
    const missionCount = {};
    
    // 임무 연결 수 계산
    for (const [missionKey, macroKey] of Object.entries(macroData.missions)) {
        missionCount[macroKey] = (missionCount[macroKey] || 0) + 1;
    }
    
    for (const [key, macro] of Object.entries(macroData.macros)) {
        try {
            const parsed = parseMacroKey(key);
            
            let food = '';
            let memo = '';
            
            if (typeof macro === 'string') {
                // 레거시 형식
            } else if (typeof macro === 'object') {
                food = macro.food || '';
                memo = macro.memo || '';
            }
            
            const count = missionCount[key] || 0;
            result.push({
                progress: parsed.progress,
                maxQuality: parsed.maxQuality,
                initialQuality: parsed.initialQuality,
                durability: parsed.durability,
                food: food,
                memo: memo,
                key: key,
                missionCount: count
            });
        } catch (e) {
            console.warn(`키 파싱 실패: ${key}`, e);
        }
    }
    
    return result;
}

// 매크로 테이블 새로고침
function refreshMacroTable() {
    const tbody = document.getElementById('macroTableBody');
    tbody.innerHTML = '';
    
    const macros = getAllMacros();
    const sortBy = document.getElementById('sortBy').value;
    
    macros.sort((a, b) => a[sortBy] - b[sortBy]);
    
    macros.forEach(macro => {
        const row = createMacroTableRow(macro);
        tbody.appendChild(row);
    });
}

// 매크로 테이블 행 생성
function createMacroTableRow(macro) {
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${macro.progress}</td>
        <td>${macro.maxQuality}</td>
        <td>${macro.initialQuality}</td>
        <td>${macro.durability}</td>
        <td>${macro.food || '-'}</td>
        <td>${macro.memo || '-'}</td>
        <td><span class="badge bg-secondary">${macro.missionCount}</span></td>
        <td>
            <button class="btn btn-sm btn-outline-primary me-1" onclick="viewMacro('${macro.key}')" title="보기">
                <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="confirmDeleteMacro('${macro.key}')" title="삭제">
                <i class="bi bi-trash"></i>
            </button>
        </td>
    `;
    
    // 더블클릭으로 보기
    row.addEventListener('dblclick', () => viewMacro(macro.key));
    
    return row;
}

// 매크로 검색
function searchMacros() {
    const progress = document.getElementById('searchProgress').value;
    const maxQuality = document.getElementById('searchMaxQuality').value;
    
    const tbody = document.getElementById('macroTableBody');
    tbody.innerHTML = '';
    
    const allMacros = getAllMacros();
    const filteredMacros = allMacros.filter(macro => {
        if (progress && macro.progress != parseInt(progress)) return false;
        if (maxQuality && macro.maxQuality != parseInt(maxQuality)) return false;
        return true;
    });
    
    const sortBy = document.getElementById('sortBy').value;
    filteredMacros.sort((a, b) => a[sortBy] - b[sortBy]);
    
    filteredMacros.forEach(macro => {
        const row = createMacroTableRow(macro);
        tbody.appendChild(row);
    });
}

// 임무 테이블 새로고침
function refreshMissionTable() {
    const tbody = document.getElementById('missionTableBody');
    tbody.innerHTML = '';
    
    const missions = Object.entries(macroData.missions).sort((a, b) => a[0].localeCompare(b[0]));
    
    missions.forEach(([missionName, macroKey]) => {
        const row = createMissionTableRow(missionName, macroKey);
        tbody.appendChild(row);
    });
}

// 임무 테이블 행 생성
function createMissionTableRow(missionName, macroKey) {
    const row = document.createElement('tr');
    
    const macro = getMacro(macroKey);
    let progress = '?', maxQuality = '?', initialQuality = '?', durability = '?', memo = '';
    
    if (macro) {
        try {
            const parsed = parseMacroKey(macroKey);
            progress = parsed.progress;
            maxQuality = parsed.maxQuality;
            initialQuality = parsed.initialQuality;
            durability = parsed.durability;
            memo = macro.memo || '';
        } catch (e) {
            memo = '파싱 오류';
        }
    } else {
        memo = '매크로 없음';
    }
    
    row.innerHTML = `
        <td>${missionName}</td>
        <td>${progress}</td>
        <td>${maxQuality}</td>
        <td>${initialQuality}</td>
        <td>${durability}</td>
        <td>${memo || '-'}</td>
        <td>
            <button class="btn btn-sm btn-outline-primary me-1" onclick="viewMacroFromMission('${macroKey}')" title="매크로 보기">
                <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="confirmUnlinkMission('${missionName}')" title="연결 해제">
                <i class="bi bi-unlink"></i>
            </button>
        </td>
    `;
    
    // 더블클릭으로 매크로 보기
    row.addEventListener('dblclick', () => viewMacroFromMission(macroKey));
    
    return row;
}

// 임무 검색
function searchMissions() {
    const searchText = document.getElementById('searchMissionName').value.toLowerCase();
    
    const tbody = document.getElementById('missionTableBody');
    tbody.innerHTML = '';
    
    const missions = Object.entries(macroData.missions)
        .filter(([missionName, macroKey]) => 
            !searchText || missionName.toLowerCase().includes(searchText)
        )
        .sort((a, b) => a[0].localeCompare(b[0]));
    
    missions.forEach(([missionName, macroKey]) => {
        const row = createMissionTableRow(missionName, macroKey);
        tbody.appendChild(row);
    });
}

// 매크로 보기
function viewMacro(macroKey) {
    currentMacroKey = macroKey;
    const macro = getMacro(macroKey);
    
    if (!macro) {
        showMacroInfo('매크로를 찾을 수 없습니다.');
        return;
    }
    
    try {
        const parsed = parseMacroKey(macroKey);
        showMacroDetails(parsed, macro, macroKey);
    } catch (e) {
        showMacroInfo('키 파싱 오류');
    }
}

// 임무에서 매크로 보기
function viewMacroFromMission(macroKey) {
    viewMacro(macroKey);
}

// 매크로 상세 정보 표시
function showMacroDetails(parsed, macro, macroKey) {
    const infoDiv = document.getElementById('macroInfo');
    
    const linkedMissions = Object.entries(macroData.missions)
        .filter(([missionName, key]) => key === macroKey)
        .map(([missionName, key]) => missionName);
    
    infoDiv.innerHTML = `
        <div class="mb-3">
            <h6 class="text-primary mb-2">기본 정보</h6>
            <div class="small">
                <div><strong>작업량:</strong> ${parsed.progress}</div>
                <div><strong>최대품질:</strong> ${parsed.maxQuality}</div>
                <div><strong>초기품질:</strong> ${parsed.initialQuality}</div>
                <div><strong>내구도:</strong> ${parsed.durability}</div>
                ${macro.food ? `<div><strong>음식:</strong> ${macro.food}</div>` : ''}
            </div>
        </div>
        
        <div class="mb-3">
            <h6 class="text-primary mb-2">메모</h6>
            <input type="text" class="form-control form-control-sm" value="${macro.memo || ''}" 
                   onchange="updateMacroMemo('${macroKey}', this.value)" placeholder="메모를 입력하세요...">
        </div>
        
        <div class="mb-3">
            <h6 class="text-primary mb-2">연결된 임무 <span class="badge bg-secondary">${linkedMissions.length}</span></h6>
            <div class="mission-list" style="max-height: 150px; overflow-y: auto;">
                ${linkedMissions.length > 0 ? 
                    linkedMissions.map(mission => `
                        <div class="mission-item d-flex justify-content-between align-items-center">
                            <span>${mission}</span>
                            <button class="btn btn-sm btn-outline-danger" onclick="confirmUnlinkMission('${mission}')" title="연결 해제">
                                <i class="bi bi-x"></i>
                            </button>
                        </div>
                    `).join('') :
                    '<div class="text-muted text-center p-2">연결된 임무가 없습니다.</div>'
                }
            </div>
            <button class="btn btn-sm btn-outline-primary mt-2" onclick="showLinkMissionModal('${macroKey}')">
                <i class="bi bi-plus"></i> 임무 연결
            </button>
        </div>
        
        <div class="mb-3">
            <h6 class="text-primary mb-2">매크로 블록</h6>
            ${createMacroBlocks(macro.text)}
        </div>
    `;
}

// 매크로 블록 생성
function createMacroBlocks(macroText) {
    if (!macroText || !macroText.trim()) {
        return '<div class="text-muted text-center p-3">매크로 내용이 없습니다.</div>';
    }
    
    const lines = macroText.split('\n');
    const blockSize = 15;
    let blocksHtml = '';
    
    for (let i = 0; i < lines.length; i += blockSize) {
        const blockLines = lines.slice(i, i + blockSize);
        const blockText = blockLines.join('\n');
        const blockNum = Math.floor(i / blockSize) + 1;
        
        blocksHtml += `
            <div class="macro-block">
                <div class="macro-block-header">
                    <span>블록 ${blockNum} (${blockLines.length}줄)</span>
                    <div>
                        <button class="btn btn-sm btn-outline-secondary me-1" onclick="toggleBlock(${blockNum})" id="toggleBtn${blockNum}">
                            펼치기
                        </button>
                        <button class="btn btn-sm btn-outline-primary" onclick="copyBlockText(\`${blockText.replace(/`/g, '\\`')}\`, ${blockNum})">
                            복사
                        </button>
                    </div>
                </div>
                <div class="macro-block-content" id="blockContent${blockNum}" style="display: none;">
                    <div class="macro-block-text">${blockText}</div>
                </div>
            </div>
        `;
    }
    
    return blocksHtml;
}

// 블록 토글
function toggleBlock(blockNum) {
    const content = document.getElementById(`blockContent${blockNum}`);
    const btn = document.getElementById(`toggleBtn${blockNum}`);
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        btn.textContent = '접기';
    } else {
        content.style.display = 'none';
        btn.textContent = '펼치기';
    }
}

// 블록 텍스트 복사
function copyBlockText(text, blockNum) {
    navigator.clipboard.writeText(text).then(() => {
        showAlert(`블록 ${blockNum}이 클립보드에 복사되었습니다.`, 'success');
    }).catch(err => {
        showAlert('복사에 실패했습니다.', 'danger');
    });
}

// 매크로 정보 표시
function showMacroInfo(message) {
    const infoDiv = document.getElementById('macroInfo');
    infoDiv.innerHTML = `
        <div class="text-muted text-center p-4">
            ${message}
        </div>
    `;
}

// 매크로 메모 업데이트
function updateMacroMemo(macroKey, memo) {
    const macro = getMacro(macroKey);
    if (macro) {
        setMacro(macroKey, macro.text, macro.food, memo);
    }
}

// 입력값 검증
function validateInputs() {
    const progress = parseInt(document.getElementById('inputProgress').value);
    const maxQuality = parseInt(document.getElementById('inputMaxQuality').value);
    const initialQuality = parseInt(document.getElementById('inputInitialQuality').value) || 0;
    const durability = parseInt(document.getElementById('inputDurability').value);
    
    if (isNaN(progress) || isNaN(maxQuality) || isNaN(durability)) {
        throw new Error('모든 수치를 입력해주세요.');
    }
    
    if (progress < 0 || maxQuality < 0 || initialQuality < 0 || durability <= 0) {
        throw new Error('작업량/최대품질/초기품질은 0 이상, 내구도는 1 이상이어야 합니다.');
    }
    
    if (initialQuality > maxQuality) {
        throw new Error('초기품질은 최대품질을 초과할 수 없습니다.');
    }
    
    return { progress, maxQuality, initialQuality, durability };
}

// 매크로 로드
function loadMacro() {
    try {
        const { progress, maxQuality, initialQuality, durability } = validateInputs();
        const macroKey = createMacroKey(progress, maxQuality, initialQuality, durability);
        
        const macro = getMacro(macroKey);
        
        if (macro) {
            document.getElementById('macroText').value = macro.text;
            document.getElementById('inputFood').value = macro.food || '';
            document.getElementById('inputMemo').value = macro.memo || '';
            
            viewMacro(macroKey);
            showAlert('기존 매크로를 불러왔습니다.', 'success');
        } else {
            document.getElementById('macroText').value = '';
            document.getElementById('inputFood').value = '';
            document.getElementById('inputMemo').value = '';
            
            showMacroInfo('매크로를 선택하세요');
            showAlert('새로운 매크로를 입력하세요.', 'info');
        }
    } catch (e) {
        showAlert(e.message, 'warning');
    }
}

// 매크로 저장
function saveMacro() {
    try {
        const { progress, maxQuality, initialQuality, durability } = validateInputs();
        const macroKey = createMacroKey(progress, maxQuality, initialQuality, durability);
        const text = document.getElementById('macroText').value.trim();
        const food = document.getElementById('inputFood').value;
        const memo = document.getElementById('inputMemo').value.trim();
        
        if (!text) {
            if (confirm('매크로 내용이 비어있습니다. 삭제하시겠습니까?')) {
                deleteMacroData(macroKey);
                clearForm();
                showMacroInfo('매크로를 선택하세요');
                refreshMacroTable();
                refreshMissionTable();
                showAlert('매크로가 삭제되었습니다.', 'success');
            }
            return;
        }
        
        setMacro(macroKey, text, food, memo);
        viewMacro(macroKey);
        refreshMacroTable();
        refreshMissionTable();
        showAlert('매크로가 저장되었습니다.', 'success');
    } catch (e) {
        showAlert(e.message, 'warning');
    }
}

// 매크로 삭제
function deleteMacro() {
    try {
        const { progress, maxQuality, initialQuality, durability } = validateInputs();
        const macroKey = createMacroKey(progress, maxQuality, initialQuality, durability);
        
        if (getMacro(macroKey)) {
            if (confirm('현재 매크로를 삭제하시겠습니까?\n연결된 임무도 함께 해제됩니다.')) {
                deleteMacroData(macroKey);
                clearForm();
                showMacroInfo('매크로를 선택하세요');
                refreshMacroTable();
                refreshMissionTable();
                showAlert('매크로가 삭제되었습니다.', 'success');
            }
        } else {
            showAlert('삭제할 매크로가 없습니다.', 'info');
        }
    } catch (e) {
        showAlert(e.message, 'warning');
    }
}

// 매크로 삭제 확인
function confirmDeleteMacro(macroKey) {
    if (confirm('선택한 매크로를 삭제하시겠습니까?\n연결된 임무도 함께 해제됩니다.')) {
        deleteMacroData(macroKey);
        refreshMacroTable();
        refreshMissionTable();
        if (currentMacroKey === macroKey) {
            showMacroInfo('매크로를 선택하세요');
        }
        showAlert('매크로가 삭제되었습니다.', 'success');
    }
}

// 폼 초기화
function clearForm() {
    document.getElementById('inputProgress').value = '';
    document.getElementById('inputMaxQuality').value = '';
    document.getElementById('inputInitialQuality').value = '0';
    document.getElementById('inputDurability').value = '';
    document.getElementById('inputFood').value = '';
    document.getElementById('inputMemo').value = '';
    document.getElementById('macroText').value = '';
    showMacroInfo('매크로를 선택하세요');
}

// 임무 연결 모달 표시
function showLinkMissionModal(macroKey) {
    currentMacroKey = macroKey;
    document.getElementById('missionNameInput').value = '';
    const modal = new bootstrap.Modal(document.getElementById('linkMissionModal'));
    modal.show();
}

// 임무 연결 확인
function confirmLinkMission() {
    const missionName = document.getElementById('missionNameInput').value.trim();
    
    if (!missionName) {
        showAlert('임무 이름을 입력하세요.', 'warning');
        return;
    }
    
    if (!currentMacroKey) {
        showAlert('매크로를 선택하세요.', 'warning');
        return;
    }
    
    macroData.missions[missionName] = currentMacroKey;
    
    // 자동 캐시 저장
    saveToCacheQuiet();
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('linkMissionModal'));
    modal.hide();
    
    viewMacro(currentMacroKey);
    refreshMissionTable();
    showAlert('임무가 연결되었습니다.', 'success');
}

// 임무 연결 해제 확인
function confirmUnlinkMission(missionName) {
    if (confirm(`'${missionName}' 임무 연결을 해제하시겠습니까?`)) {
        delete macroData.missions[missionName];
        
        // 자동 캐시 저장
        saveToCacheQuiet();
        
        if (currentMacroKey) {
            viewMacro(currentMacroKey);
        }
        refreshMissionTable();
        showAlert('임무 연결이 해제되었습니다.', 'success');
    }
}

// 데이터 내보내기
function exportData() {
    const dataStr = JSON.stringify(macroData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'space_craft_macros.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showAlert('데이터가 다운로드되었습니다.', 'success');
}

// 데이터 가져오기 (파일)
function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (confirm('기존 데이터를 새로운 데이터로 교체하시겠습니까?')) {
                macroData = data;
                // 새 데이터를 캐시에 저장
                saveToCacheQuiet();
                refreshMacroTable();
                refreshMissionTable();
                showMacroInfo('매크로를 선택하세요');
                showAlert('데이터가 성공적으로 로드되었습니다.', 'success');
            }
        } catch (err) {
            console.error('JSON 파싱 오류:', err);
            showAlert(`JSON 파일 오류: ${err.message}<br><br>💡 해결 방법:<br>1. 파일이 UTF-8 인코딩인지 확인<br>2. debug.html로 파일 검증<br>3. 따옴표와 중괄호가 제대로 닫혔는지 확인`, 'danger');
        }
    };
    reader.readAsText(file);
    
    // 파일 입력 초기화
    event.target.value = '';
}

// JSON 데이터 로드
function loadJsonData() {
    const jsonText = document.getElementById('jsonInput').value.trim();
    
    if (!jsonText) {
        showAlert('JSON 데이터를 입력하세요.', 'warning');
        return;
    }
    
    try {
        const data = JSON.parse(jsonText);
        
        if (confirm('기존 데이터를 새로운 데이터로 교체하시겠습니까?')) {
            macroData = data;
            // 새 데이터를 캐시에 저장
            saveToCacheQuiet();
            refreshMacroTable();
            refreshMissionTable();
            showMacroInfo('매크로를 선택하세요');
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('jsonInputModal'));
            modal.hide();
            
            showAlert('데이터가 성공적으로 로드되었습니다.', 'success');
        }
    } catch (err) {
        console.error('JSON 파싱 오류:', err);
        showAlert(`JSON 형식 오류: ${err.message}<br><br>💡 해결 방법:<br>1. JSON 구문이 올바른지 확인<br>2. debug.html로 검증<br>3. 특수문자가 제대로 이스케이프되었는지 확인`, 'danger');
    }
}

// 캐시 정보 표시
function showCacheInfo() {
    const info = getCacheInfo();
    if (!info) {
        showAlert('캐시된 데이터가 없습니다.', 'info');
        return;
    }
    
    const sizeKB = (info.size / 1024).toFixed(2);
    const savedDate = new Date(info.savedAt).toLocaleString('ko-KR');
    
    const message = `
        <strong>캐시 정보</strong><br>
        📄 매크로: ${info.macros}개<br>
        📋 임무: ${info.missions}개<br>
        💾 용량: ${sizeKB} KB<br>
        🕒 저장 시간: ${savedDate}
    `;
    
    showAlert(message, 'info');
}

// 캐시 삭제 확인
function confirmClearCache() {
    const info = getCacheInfo();
    if (!info) {
        showAlert('삭제할 캐시 데이터가 없습니다.', 'info');
        return;
    }
    
    if (confirm(`캐시된 데이터를 모두 삭제하시겠습니까?\n\n매크로: ${info.macros}개\n임무: ${info.missions}개\n\n⚠️ 이 작업은 되돌릴 수 없습니다.`)) {
        clearCache();
    }
}

// 알림 표시
function showAlert(message, type = 'info') {
    // 기존 알림 제거
    const existingAlert = document.querySelector('.alert-container');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert-container position-fixed top-0 start-50 translate-middle-x mt-3';
    alertDiv.style.zIndex = '9999';
    alertDiv.innerHTML = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    document.body.appendChild(alertDiv);
    
    // 3초 후 자동 제거
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 3000);
}
