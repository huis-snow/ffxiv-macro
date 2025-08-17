// 전역 변수
var macroData = {
    macros: {},
    missions: {}
};

var currentMacroKey = null;

// localStorage 키
const STORAGE_KEY = 'ffxiv_macro_data';
const THEME_STORAGE_KEY = 'ffxiv_theme_preference';

// 정렬 상태
let currentSort = {
    column: 'progress',
    direction: 'asc' // asc, desc
};

// 초기화
document.addEventListener('DOMContentLoaded', function() {
    // 테마 설정 로드
    loadThemePreference();
    
    // 캐시된 데이터 로드
    loadCachedData();
    
    // 이벤트 리스너 등록
    registerEventListeners();
    
    // DOM이 완전히 준비된 후 테이블 렌더링
    setTimeout(() => {
        console.log('초기 테이블 렌더링 시작');
        loadAllMacros();
    }, 100);
    
    // 페이지 언로드 시 자동 저장
    window.addEventListener('beforeunload', function() {
        saveToCacheQuiet();
    });
});

// 이벤트 리스너 등록
function registerEventListeners() {
    // 검색 필드에서 엔터키
    const searchProgress = document.getElementById('searchProgress');
    if (searchProgress) {
        searchProgress.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') searchMacros();
        });
        
        // 작업량 입력 변화 감지
        searchProgress.addEventListener('input', function(e) {
            const createBtn = document.getElementById('createWithProgressBtn');
            if (createBtn) {
                if (e.target.value.trim()) {
                    createBtn.style.display = 'inline-block';
                } else {
                    createBtn.style.display = 'none';
                }
            }
        });
    }
    
    // 매크로 생성 탭의 입력 필드에서 엔터키
    const inputFields = ['inputProgress', 'inputMaxQuality', 'inputInitialQuality', 'inputDurability'];
    inputFields.forEach(fieldId => {
        const element = document.getElementById(fieldId);
        if (element) {
            element.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') loadMacro();
            });
        }
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
    let foundMacro = macroData.macros[key];
    
    if (!foundMacro) {
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
                    foundMacro = macroData.macros[possibleKey];
                    break;
                }
            }
        } catch (e) {
            // 파싱 실패
        }
    }
    
    if (!foundMacro) {
        return null;
    }
    
    // 레거시 형식 지원
    if (typeof foundMacro === 'string') {
        return {
            text: foundMacro,
            food: '',
            memo: ''
        };
    }
    
    return {
        text: foundMacro.text || '',
        food: foundMacro.food || '',
        memo: foundMacro.memo || ''
    };
}

// 매크로 저장
function setMacro(key, text, food = '', memo = '', masterPotion = false) {
    macroData.macros[key] = {
        text: text,
        food: food,
        memo: memo,
        masterPotion: masterPotion
    };
    // 자동 캐시 저장
    saveToCacheQuiet();
}

// 매크로 삭제
function deleteMacroData(key) {
    if (macroData.macros[key]) {
        delete macroData.macros[key];
        
        // 자동 캐시 저장
        saveToCacheQuiet();
    }
}

// 모든 매크로 목록 가져오기
function getAllMacros() {
    const result = [];
    
    for (const [key, macro] of Object.entries(macroData.macros)) {
        try {
            const parsed = parseMacroKey(key);
            
            let food = '';
            let memo = '';
            let masterPotion = false;
            
            if (typeof macro === 'string') {
                // 레거시 형식
            } else if (typeof macro === 'object') {
                food = macro.food || '';
                memo = macro.memo || '';
                masterPotion = macro.masterPotion || false;
            }
            
            result.push({
                progress: parsed.progress,
                maxQuality: parsed.maxQuality,
                initialQuality: parsed.initialQuality,
                durability: parsed.durability,
                food: food,
                masterPotion: masterPotion,
                memo: memo,
                key: key
            });
        } catch (e) {
            console.warn(`키 파싱 실패: ${key}`, e);
        }
    }
    
    return result;
}

// 매크로 테이블 새로고침 (전체 버튼용)
function refreshMacroTable() {
    // 작업량 검색 필드 초기화
    document.getElementById('searchProgress').value = '';
    
    // 매크로 생성 버튼 숨기기
    const createBtn = document.getElementById('createWithProgressBtn');
    if (createBtn) {
        createBtn.style.display = 'none';
    }
    
    // 정렬 아이콘 초기화 및 테이블 렌더링
    updateSortIcons();
    renderSortedTable();
}

// 매크로 테이블 렌더링 (검색 필드 건드리지 않음)
function loadAllMacros() {
    console.log('loadAllMacros 호출됨, 매크로 개수:', Object.keys(macroData.macros).length);
    
    // 테이블 요소가 존재하는지 확인
    const tbody = document.getElementById('macroTableBody');
    if (!tbody) {
        console.error('macroTableBody 요소를 찾을 수 없습니다.');
        return;
    }
    
    updateSortIcons();
    renderSortedTable();
}

// 매크로 테이블 행 생성
function createMacroTableRow(macro) {
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>
            <button class="btn btn-sm btn-primary" onclick="selectMacro('${macro.key}', this)">선택</button>
        </td>
        <td>${macro.progress}</td>
        <td>${macro.maxQuality}</td>
        <td>${macro.initialQuality}</td>
        <td>${macro.durability}</td>
        <td>${macro.food || '-'}</td>
        <td>${macro.masterPotion ? '✓' : '-'}</td>
        <td>${macro.memo || '-'}</td>
        <td>
            <button class="btn btn-sm btn-outline-success me-1" onclick="editMacro('${macro.key}')" title="수정">
                <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="confirmDeleteMacro('${macro.key}')" title="삭제">
                <i class="bi bi-trash"></i>
            </button>
        </td>
    `;
    
    // 행 클릭으로 선택
    row.addEventListener('click', (e) => {
        // 버튼이 아닌 곳을 클릭했을 때만 선택
        if (!e.target.closest('button')) {
            selectMacro(macro.key, row);
        }
    });
    
    // 매크로 키를 데이터 속성으로 저장
    row.dataset.macroKey = macro.key;
    
    return row;
}

// 매크로 검색
function searchMacros() {
    const progress = document.getElementById('searchProgress').value;
    
    const tbody = document.getElementById('macroTableBody');
    tbody.innerHTML = '';
    
    const allMacros = getAllMacros();
    const filteredMacros = allMacros.filter(macro => {
        if (progress && macro.progress != parseInt(progress)) return false;
        return true;
    });
    
    // 정렬 적용
    filteredMacros.sort((a, b) => {
        let aVal = a[currentSort.column];
        let bVal = b[currentSort.column];
        
        // 숫자 정렬
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return currentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        // 문자열 정렬
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
        
        if (currentSort.direction === 'asc') {
            return aVal.localeCompare(bVal);
        } else {
            return bVal.localeCompare(aVal);
        }
    });
    
    filteredMacros.forEach(macro => {
        const row = createMacroTableRow(macro);
        tbody.appendChild(row);
    });
}

// 검색한 작업량으로 매크로 생성
function createMacroWithProgress() {
    const progress = document.getElementById('searchProgress').value.trim();
    
    if (!progress) {
        showAlert('작업량을 입력하세요.', 'warning');
        return;
    }
    
    try {
        // 매크로 생성 탭으로 이동
        const createTab = document.querySelector('#create-tab');
        if (createTab) {
            const tabTrigger = new bootstrap.Tab(createTab);
            tabTrigger.show();
        }
        
        // 잠시 후 폼에 작업량 입력
        setTimeout(() => {
            document.getElementById('inputProgress').value = progress;
            document.getElementById('inputProgress').focus();
        }, 100);
        
        showAlert(`작업량 ${progress}으로 매크로 생성을 시작합니다.`, 'info');
        
    } catch (error) {
        console.error('매크로 생성 오류:', error);
        showAlert('매크로 생성 중 오류가 발생했습니다.', 'danger');
    }
}

// 테이블 정렬
function sortTable(column) {
    // 같은 컬럼을 클릭하면 방향 변경, 다른 컬럼이면 오름차순으로 시작
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
    }
    
    // 헤더 아이콘 업데이트
    updateSortIcons();
    
    // 테이블 정렬 및 재렌더링
    renderSortedTable();
}

// 정렬 아이콘 업데이트
function updateSortIcons() {
    // 모든 정렬 아이콘 초기화
    ['progress', 'maxQuality', 'initialQuality', 'durability'].forEach(col => {
        const icon = document.getElementById(`sort-${col}`);
        if (icon) {
            icon.className = 'bi bi-arrow-down-up';
        }
    });
    
    // 현재 정렬 컬럼의 아이콘 업데이트
    const currentIcon = document.getElementById(`sort-${currentSort.column}`);
    if (currentIcon) {
        currentIcon.className = currentSort.direction === 'asc' 
            ? 'bi bi-arrow-up' 
            : 'bi bi-arrow-down';
    }
}

// 정렬된 테이블 렌더링
function renderSortedTable() {
    const tbody = document.getElementById('macroTableBody');
    if (!tbody) {
        console.error('macroTableBody 요소를 찾을 수 없습니다.');
        return;
    }
    
    tbody.innerHTML = '';
    
    const macros = getAllMacros();
    console.log('renderSortedTable: 매크로 개수 =', macros.length);
    
    // 데이터가 없을 때 안내 메시지
    if (macros.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center text-muted p-4">
                    <i class="bi bi-inbox display-6 d-block mb-2"></i>
                    <div>저장된 매크로가 없습니다.</div>
                    <small>상단의 "데이터 가져오기" 버튼을 사용하거나 "매크로 생성" 탭에서 새로 만드세요.</small>
                </td>
            </tr>
        `;
        return;
    }
    
    // 정렬
    macros.sort((a, b) => {
        let aVal = a[currentSort.column];
        let bVal = b[currentSort.column];
        
        // 숫자 정렬
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return currentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        // 문자열 정렬
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
        
        if (currentSort.direction === 'asc') {
            return aVal.localeCompare(bVal);
        } else {
            return bVal.localeCompare(aVal);
        }
    });
    
    macros.forEach((macro, index) => {
        const row = createMacroTableRow(macro);
        tbody.appendChild(row);
        if (index < 3) { // 처음 3개만 로그
            console.log(`행 추가: ${macro.key}`);
        }
    });
    
    console.log('테이블 렌더링 완료. 총 행 수:', tbody.children.length);
}

// 매크로 선택 (하이라이트 + 첫 블록 복사)
function selectMacro(macroKey, element) {
    // 기존 하이라이트 제거
    document.querySelectorAll('#macroTableBody tr').forEach(row => {
        row.classList.remove('table-active');
    });
    
    // 새로운 하이라이트 적용
    let targetRow = element;
    if (element.tagName === 'BUTTON') {
        targetRow = element.closest('tr');
    }
    if (targetRow) {
        targetRow.classList.add('table-active');
    }
    
    // 매크로 정보 표시
    viewMacro(macroKey);
    
    // 첫 번째 블록 자동 복사
    copyFirstBlock(macroKey);
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

// 첫 번째 블록 자동 복사
function copyFirstBlock(macroKey) {
    try {
        const macro = getMacro(macroKey);
        if (!macro || !macro.text) {
            return;
        }
        
        const lines = macro.text.split('\n');
        const blockSize = 15;
        const firstBlockLines = lines.slice(0, blockSize);
        const firstBlockText = firstBlockLines.join('\n');
        
        navigator.clipboard.writeText(firstBlockText).then(() => {
            showAlert('첫 번째 블록이 클립보드에 복사되었습니다.', 'success');
        }).catch(err => {
            console.error('클립보드 복사 오류:', err);
        });
    } catch (error) {
        console.error('첫 번째 블록 복사 오류:', error);
    }
}

// 매크로 상세 정보 표시
function showMacroDetails(parsed, macro, macroKey) {
    const infoDiv = document.getElementById('macroInfo');
    
    infoDiv.innerHTML = `
        <div class="mb-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <h6 class="text-primary mb-0">기본 정보</h6>
                <button class="btn btn-sm btn-outline-success" onclick="editMacro('${macroKey}')" title="매크로 수정">
                    <i class="bi bi-pencil"></i> 수정
                </button>
            </div>
            <div class="small">
                <div><strong>작업량:</strong> ${parsed.progress}</div>
                <div><strong>최대품질:</strong> ${parsed.maxQuality}</div>
                <div><strong>초기품질:</strong> ${parsed.initialQuality}</div>
                <div><strong>내구도:</strong> ${parsed.durability}</div>
                <div><strong>음식:</strong> ${macro.food || '없음'}</div>
                <div><strong>명인의 약액:</strong> ${macro.masterPotion ? '✓ 사용' : '미사용'}</div>
            </div>
        </div>
        
        <div class="mb-3">
            <h6 class="text-primary mb-2">메모</h6>
            <input type="text" class="form-control form-control-sm" value="${macro.memo || ''}" 
                   onchange="updateMacroMemo('${macroKey}', this.value)" placeholder="메모를 입력하세요...">
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
        
        // HTML과 특수문자를 안전하게 이스케이프
        const escapedText = blockText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
        
        blocksHtml += `
            <div class="macro-block">
                <div class="macro-block-header">
                    <span>블록 ${blockNum} (${blockLines.length}줄)</span>
                    <div>
                        <button class="btn btn-sm btn-outline-secondary me-1" onclick="toggleBlock(${blockNum})" id="toggleBtn${blockNum}">
                            펼치기
                        </button>
                        <button class="btn btn-sm btn-outline-primary" onclick="copyBlockTextSafe(${blockNum})">
                            복사
                        </button>
                    </div>
                </div>
                <div class="macro-block-content" id="blockContent${blockNum}" style="display: none;">
                    <div class="macro-block-text">${escapedText}</div>
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

// 안전한 블록 텍스트 복사
function copyBlockTextSafe(blockNum) {
    try {
        // 전역 변수에서 현재 매크로의 원본 텍스트를 가져옴
        if (!currentMacroKey) {
            showAlert('매크로를 선택하세요.', 'warning');
            return;
        }
        
        const macro = getMacro(currentMacroKey);
        if (!macro) {
            showAlert('매크로 데이터를 찾을 수 없습니다.', 'danger');
            return;
        }
        
        const lines = macro.text.split('\n');
        const blockSize = 15;
        const startIndex = (blockNum - 1) * blockSize;
        const endIndex = Math.min(startIndex + blockSize, lines.length);
        const blockLines = lines.slice(startIndex, endIndex);
        const blockText = blockLines.join('\n');
        
        navigator.clipboard.writeText(blockText).then(() => {
            showAlert(`블록 ${blockNum}이 클립보드에 복사되었습니다.`, 'success');
        }).catch(err => {
            console.error('클립보드 복사 오류:', err);
            showAlert('복사에 실패했습니다.', 'danger');
        });
    } catch (error) {
        console.error('복사 함수 오류:', error);
        showAlert('복사 중 오류가 발생했습니다.', 'danger');
    }
}

// 레거시 블록 텍스트 복사 (혹시 다른 곳에서 사용 중일 수 있음)
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

// 특정 매크로 행 업데이트
function updateTableRow(macroKey) {
    const tbody = document.getElementById('macroTableBody');
    if (!tbody) return;
    
    // 해당 매크로 키를 가진 행 찾기
    const rows = tbody.querySelectorAll('tr');
    for (const row of rows) {
        if (row.dataset.macroKey === macroKey) {
            // 매크로 데이터 가져오기
            const macro = getMacro(macroKey);
            if (!macro) return;
            
            const parsed = parseMacroKey(macroKey);
            
            // 매크로 객체 생성 (getAllMacros와 동일한 형태)
            const macroObj = {
                progress: parsed.progress,
                maxQuality: parsed.maxQuality,
                initialQuality: parsed.initialQuality,
                durability: parsed.durability,
                food: macro.food || '',
                masterPotion: macro.masterPotion || false,
                memo: macro.memo || '',
                key: macroKey
            };
            
            // 새로운 행 생성하여 교체
            const newRow = createMacroTableRow(macroObj);
            row.parentNode.replaceChild(newRow, row);
            
            // 하이라이트가 있었다면 유지
            if (row.classList.contains('table-active')) {
                newRow.classList.add('table-active');
            }
            
            break;
        }
    }
}

// 매크로 메모 업데이트
function updateMacroMemo(macroKey, memo) {
    const macro = getMacro(macroKey);
    if (macro) {
        setMacro(macroKey, macro.text, macro.food, memo, macro.masterPotion);
        
        // 테이블의 해당 행 업데이트
        updateTableRow(macroKey);
        
        showAlert('메모가 업데이트되었습니다.', 'success');
    }
}

// 매크로 수정 (매크로 생성 탭으로 이동하며 데이터 로딩)
function editMacro(macroKey) {
    try {
        // 매크로 데이터 가져오기
        const macro = getMacro(macroKey);
        if (!macro) {
            showAlert('매크로 데이터를 찾을 수 없습니다.', 'danger');
            return;
        }
        
        // 매크로 키 파싱
        const parsed = parseMacroKey(macroKey);
        
        // 매크로 생성 탭으로 이동
        const createTab = document.querySelector('#create-tab');
        if (createTab) {
            // Bootstrap 탭 활성화
            const tabTrigger = new bootstrap.Tab(createTab);
            tabTrigger.show();
        }
        
        // 잠시 후 폼에 데이터 로딩 (탭 전환이 완료된 후)
        setTimeout(() => {
            loadMacroToForm(parsed, macro);
        }, 100);
        
        showAlert('매크로 수정 모드로 전환되었습니다.', 'info');
        
    } catch (error) {
        console.error('매크로 수정 오류:', error);
        showAlert('매크로 수정 중 오류가 발생했습니다.', 'danger');
    }
}

// 폼에 매크로 데이터 로딩
function loadMacroToForm(parsed, macro) {
    try {
        // 기본 정보 입력
        document.getElementById('inputProgress').value = parsed.progress;
        document.getElementById('inputMaxQuality').value = parsed.maxQuality;
        document.getElementById('inputInitialQuality').value = parsed.initialQuality;
        document.getElementById('inputDurability').value = parsed.durability;
        
        // 음식, 명인의 약액 및 메모
        document.getElementById('inputFood').value = macro.food || '';
        document.getElementById('inputMasterPotion').checked = macro.masterPotion || false;
        document.getElementById('inputMemo').value = macro.memo || '';
        
        // 매크로 텍스트
        document.getElementById('macroText').value = macro.text || '';
        
        console.log('매크로 데이터가 폼에 로딩되었습니다:', {
            progress: parsed.progress,
            maxQuality: parsed.maxQuality,
            initialQuality: parsed.initialQuality,
            durability: parsed.durability,
            food: macro.food,
            memo: macro.memo
        });
        
    } catch (error) {
        console.error('폼 로딩 오류:', error);
        showAlert('폼에 데이터를 로딩하는 중 오류가 발생했습니다.', 'warning');
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
        console.log('saveMacro 시작, macroData:', macroData);
        
        const { progress, maxQuality, initialQuality, durability } = validateInputs();
        const macroKey = createMacroKey(progress, maxQuality, initialQuality, durability);
        const text = document.getElementById('macroText').value.trim();
        const food = document.getElementById('inputFood').value;
        const memo = document.getElementById('inputMemo').value.trim();
        const masterPotion = document.getElementById('inputMasterPotion').checked;
        
        console.log('매크로 키:', macroKey);
        console.log('매크로 텍스트:', text);
        
        if (!text) {
            if (confirm('매크로 내용이 비어있습니다. 삭제하시겠습니까?')) {
                deleteMacroData(macroKey);
                clearForm();
                showMacroInfo('매크로를 선택하세요');
                refreshMacroTable();
                showAlert('매크로가 삭제되었습니다.', 'success');
            }
            return;
        }
        
        console.log('setMacro 호출 전');
        setMacro(macroKey, text, food, memo, masterPotion);
        console.log('setMacro 호출 후');
        
        viewMacro(macroKey);
        refreshMacroTable();
        showAlert('매크로가 저장되었습니다.', 'success');
    } catch (e) {
        console.error('saveMacro 오류:', e);
        showAlert(e.message, 'warning');
    }
}

// 매크로 삭제
function deleteMacro() {
    try {
        const { progress, maxQuality, initialQuality, durability } = validateInputs();
        const macroKey = createMacroKey(progress, maxQuality, initialQuality, durability);
        
        if (getMacro(macroKey)) {
            if (confirm('현재 매크로를 삭제하시겠습니까?')) {
                deleteMacroData(macroKey);
                clearForm();
                showMacroInfo('매크로를 선택하세요');
                refreshMacroTable();
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
    if (confirm('선택한 매크로를 삭제하시겠습니까?')) {
        deleteMacroData(macroKey);
        refreshMacroTable();
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
    document.getElementById('inputMasterPotion').checked = false;
    document.getElementById('inputMemo').value = '';
    document.getElementById('macroText').value = '';
    showMacroInfo('매크로를 선택하세요');
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

// 다크모드 관련 함수들
function loadThemePreference() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'dark') {
        enableDarkMode();
    } else {
        enableLightMode();
    }
}

function toggleDarkMode() {
    const isDarkMode = document.body.classList.contains('dark-mode');
    if (isDarkMode) {
        enableLightMode();
    } else {
        enableDarkMode();
    }
}

function enableDarkMode() {
    document.body.classList.add('dark-mode');
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    updateThemeToggleButton(true);
}

function enableLightMode() {
    document.body.classList.remove('dark-mode');
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    updateThemeToggleButton(false);
}

function updateThemeToggleButton(isDarkMode) {
    const toggleBtn = document.getElementById('themeToggle');
    if (toggleBtn) {
        const icon = toggleBtn.querySelector('i');
        if (isDarkMode) {
            icon.className = 'bi bi-sun-fill';
            toggleBtn.title = '라이트 모드로 전환';
        } else {
            icon.className = 'bi bi-moon-fill';
            toggleBtn.title = '다크 모드로 전환';
        }
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
