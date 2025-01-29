
document.getElementById('generateInputs').addEventListener('click', () => {
    const numProcesses = parseInt(document.getElementById('numProcesses').value);
    const inputsDiv = document.getElementById('inputs');
    const algorithm = document.getElementById('algorithm').value;

    inputsDiv.innerHTML = '';

    for (let i = 0; i < numProcesses; i++) {
        inputsDiv.innerHTML += `
            <div>
                <label>Process P${i + 1} - Arrival Time:</label>
                <input type="number" id="arrivalTime${i}" required>
                <label>Burst Time:</label>
                <input type="number" id="burstTime${i}" required>
                ${algorithm.includes('priority') ? 
                    `<label>Priority:</label>
                     <input type="number" id="priority${i}" required>` 
                    : ''}
            </div>`;
    }

    document.getElementById('calculate').style.display = 'block';
});

document.getElementById('calculate').addEventListener('click', () => {
    const numProcesses = parseInt(document.getElementById('numProcesses').value);
    const algorithm = document.getElementById('algorithm').value;

    let processes = [];
    for (let i = 0; i < numProcesses; i++) {
        const arrivalTime = parseInt(document.getElementById(`arrivalTime${i}`).value);
        const burstTime = parseInt(document.getElementById(`burstTime${i}`).value);

        // Validate input
        if (isNaN(arrivalTime) || isNaN(burstTime) || burstTime <= 0) {
            // alert(`Invalid input for Process P${i + 1}. Please ensure all fields are filled correctly.`);
            Toastify({
                text: `Invalid input for Process P${i + 1}. Please ensure all fields are filled correctly.`,
                duration: 3000, // Notification duration in milliseconds
                gravity: "top", // Position: top or bottom
                position: "center", // Position: left, center, right
                backgroundColor: "linear-gradient(to right,rgb(39, 116, 172),rgb(13, 95, 146))",
            }).showToast();
            return;
        }

        processes.push({
            pid: `P${i + 1}`,
            arrivalTime,
            burstTime,
            originalBurstTime: burstTime, // Save original burst time
            priority: document.getElementById(`priority${i}`)?.value ? 
                      parseInt(document.getElementById(`priority${i}`).value) : null
        });
    }

    let metrics, data;
    switch (algorithm) {
        case 'fcfs':
            data = fcfs(processes);
            break;
        case 'sjf':
            data = sjf(processes, false);
            break;
        case 'srtf':
            data = performSRTFScheduling(processes);              
            break;
            case 'rr': {
                // Show the modal
                const modal = document.getElementById('quantumModal');
                const quantumInput = document.getElementById('quantumInput');
                const submitQuantum = document.getElementById('submitQuantum');
                const closeModal = document.querySelector('.close');
            
                modal.style.display = 'block'; 
            
                
                closeModal.addEventListener('click', () => {
                    modal.style.display = 'none';
                });
            
                
                submitQuantum.addEventListener('click', () => {
                    const quantum = parseInt(quantumInput.value);
            
                    if (isNaN(quantum) || quantum <= 0) {
                        Toastify({
                            text: 'Invalid quantum. Please enter a positive number.',
                            duration: 3000,
                            gravity: "top",
                            position: "center",
                            backgroundColor: "linear-gradient(to right, #ff5f6d, #ffc371)",
                        }).showToast();
                        return;
                    }
            
                    modal.style.display = 'none'; 
            
                    
                    const data = executeRoundRobin(processes, quantum);
            
                    
                    renderMetricsTable(data.metrics);
                    renderAverages(data.metrics);
                    drawGanttChart(data);
                });
            
                break;
            }
            case 'priority_np':
            data = nonPreemptivePriorityScheduling(processes);
            break;
        case 'priority_p':
            data = performPriorityPreemptiveScheduling(processes);
            break;
    }
    renderMetricsTable(data.metrics);
    renderAverages(data.metrics);
    drawGanttChart(data);
});

function fcfs(processes) {
    // Sort processes by arrival time
    const temp = [...processes].sort((a, b) => a.arrivalTime - b.arrivalTime);
    
    let currentTime = 0;
    const executionSequence = [];
    
    // Process each job and create metrics
    const metrics = temp.map(process => {
        // If there's idle time before the process
        if (currentTime < process.arrivalTime) {
            executionSequence.push({
                pid: 'idle',
                startTime: currentTime,
                endTime: process.arrivalTime
            });
            currentTime = process.arrivalTime;
        }

        // Add process execution to sequence
        const startTime = currentTime;
        currentTime += process.burstTime;
        
        executionSequence.push({
            pid: process.pid,
            startTime: startTime,
            endTime: currentTime
        });

        // Calculate metrics
        const completionTime = currentTime;
        const tat = completionTime - process.arrivalTime;
        const wt = tat - process.burstTime;

        return {
            ...process,
            completionTime,
            tat,
            wt
        };
    });

    return { metrics, executionSequence };
}







function performPriorityPreemptiveScheduling(processes) {
    const temp = processes.map(p => ({
        ...p,
        remainingTime: p.burstTime,
        completionTime: 0,
        tat: 0,
        wt: 0,
        started: false
    }));

    let currentTime = 0;
    let completed = 0;
    const n = processes.length;

    // Store the execution sequence with time intervals
    const executionSequence = [];
    let currentProcess = null;
    let currentProcessStartTime = 0;

    while (completed !== n) {
        let minPriority = Number.MAX_VALUE;
        let selectedProcess = null;

        for (const process of temp) {
            if (process.arrivalTime <= currentTime && 
                process.remainingTime > 0 && 
                process.priority < minPriority) {
                    minPriority = process.priority;
                    selectedProcess = process;
            }
        }

        if (selectedProcess === null) {
            // If there's an idle period, add it to the sequence
            if (currentProcess !== null) {
                executionSequence.push({
                    pid: currentProcess.pid,
                    startTime: currentProcessStartTime,
                    endTime: currentTime
                });
                currentProcess = null;
            }
            currentTime++;
            continue;
        }

        // If there's a process switch, record the previous process's interval
        if (currentProcess !== selectedProcess) {
            if (currentProcess !== null) {
                executionSequence.push({
                    pid: currentProcess.pid,
                    startTime: currentProcessStartTime,
                    endTime: currentTime
                });
            }
            currentProcess = selectedProcess;
            currentProcessStartTime = currentTime;
        }

        selectedProcess.remainingTime--;

        if (selectedProcess.remainingTime === 0) {
            completed++;
            selectedProcess.completionTime = currentTime + 1;
            selectedProcess.tat = selectedProcess.completionTime - selectedProcess.arrivalTime;
            selectedProcess.wt = selectedProcess.tat - selectedProcess.burstTime;

            // Record the final interval for this process
            executionSequence.push({
                pid: selectedProcess.pid,
                startTime: currentProcessStartTime,
                endTime: currentTime + 1
            });
            currentProcess = null;
        }

        currentTime++;
    }

    const metrics = temp.map(({ pid, arrivalTime, burstTime, priority, completionTime, tat, wt }) => ({
        pid,
        arrivalTime,
        burstTime,
        priority,
        completionTime,
        tat,
        wt
    }));

    return { metrics, executionSequence };
}








function sjf(processes, preemptive) {
    let time = 0, completed = 0;
    const metrics = [];
    const executionSequence = [];
    const remainingProcesses = processes.map(p => ({ 
        ...p, 
        burstTime: p.burstTime,
        originalBurstTime: p.burstTime 
    }));

    let currentRunningPid = null;
    let currentProcessStartTime = null;

    while (completed < processes.length) {
        const availableProcesses = remainingProcesses.filter(p => 
            p.arrivalTime <= time && p.burstTime > 0
        );
        availableProcesses.sort((a, b) => a.burstTime - b.burstTime);

        if (availableProcesses.length === 0) {
            // If there was a running process, add it to sequence before idle
            if (currentRunningPid !== null) {
                executionSequence.push({
                    pid: currentRunningPid,
                    startTime: currentProcessStartTime,
                    endTime: time
                });
                currentRunningPid = null;
            }
            
            // Track idle time
            const nextArrival = Math.min(...remainingProcesses
                .filter(p => p.burstTime > 0)
                .map(p => p.arrivalTime));
            
            executionSequence.push({
                pid: 'idle',
                startTime: time,
                endTime: nextArrival
            });
            
            time = nextArrival;
            continue;
        }

        const currentProcess = preemptive ? availableProcesses[0] : availableProcesses.shift();
        const burst = preemptive ? 1 : currentProcess.burstTime;

        // Handle process switching in execution sequence
        if (currentRunningPid !== currentProcess.pid) {
            if (currentRunningPid !== null) {
                executionSequence.push({
                    pid: currentRunningPid,
                    startTime: currentProcessStartTime,
                    endTime: time
                });
            }
            currentRunningPid = currentProcess.pid;
            currentProcessStartTime = time;
        }

        currentProcess.burstTime -= burst;
        time += burst;

        if (currentProcess.burstTime === 0) {
            // Add final execution sequence entry for completed process
            executionSequence.push({
                pid: currentProcess.pid,
                startTime: currentProcessStartTime,
                endTime: time
            });
            currentRunningPid = null;

            const completionTime = time;
            const tat = completionTime - currentProcess.arrivalTime;
            const wt = tat - currentProcess.originalBurstTime;

            metrics.push({
                pid: currentProcess.pid,
                arrivalTime: currentProcess.arrivalTime,
                burstTime: currentProcess.originalBurstTime,
                completionTime,
                tat,
                wt
            });
            completed++;
        }
    }

    // Sort metrics by PID to maintain consistent order
    metrics.sort((a, b) => a.pid.localeCompare(b.pid));

    return { metrics, executionSequence };
}



function executeRoundRobin(processes, quantum) {
    // Sort processes by arrival time
    processes.sort((a, b) => a.arrivalTime - b.arrivalTime);

    let currentTime = 0;
    const remainingBurstTimes = processes.map(p => p.burstTime);
    const executionSequence = []; // Stores Gantt chart details
    const metrics = [];
    const queue = [];
    let completed = 0;
    let processIndex = 0; // Tracks the next process to arrive

    while (completed < processes.length) {
        // Add processes to the queue if they have arrived
        while (processIndex < processes.length && processes[processIndex].arrivalTime <= currentTime) {
            queue.push(processIndex);
            processIndex++;
        }

        if (queue.length === 0) {
            // No ready process, advance time to the next arrival
            currentTime = processes[processIndex].arrivalTime;
            continue;
        }

        let index = queue.shift(); // Take the first process from the queue
        const process = processes[index];
        const executeTime = Math.min(quantum, remainingBurstTimes[index]);
        const startTime = currentTime;
        currentTime += executeTime;
        remainingBurstTimes[index] -= executeTime;

        executionSequence.push({ pid: process.pid, startTime, endTime: currentTime });

        // Add new processes that arrive during execution
        while (processIndex < processes.length && processes[processIndex].arrivalTime <= currentTime) {
            queue.push(processIndex);
            processIndex++;
        }

        // Mark process as completed or re-add to queue
        if (remainingBurstTimes[index] === 0) {
            completed++;
            const finishTime = currentTime;
            const tat = finishTime - process.arrivalTime;
            const wt = tat - process.burstTime;

            metrics.push({
                pid: process.pid,
                arrivalTime: process.arrivalTime,
                burstTime: process.burstTime,
                completionTime: finishTime,
                tat,
                wt
            });
        } else {
            queue.push(index); // Re-add process to the end of the queue
        }
    }

    metrics.sort((a, b) => a.pid.localeCompare(b.pid)); // Sort metrics by process ID

    // Fix Gantt Chart for better readability
    const formattedGanttChart = executionSequence.map(
        (step) => `${step.pid} (${step.startTime}-${step.endTime})`
    );

    console.log("Gantt Chart:", formattedGanttChart.join(" -> "));
    return { metrics, executionSequence };
}













function nonPreemptivePriorityScheduling(processes) {
    let time = 0, completed = 0;
    const metrics = [];
    const executionSequence = [];
    const remainingProcesses = processes.map(p => ({
        ...p,
        burstTime: p.burstTime,
        originalBurstTime: p.burstTime,
        priority: p.priority
    }));

    while (completed < processes.length) {
        // Filter and sort processes by arrival time and priority
        const availableProcesses = remainingProcesses.filter(p => 
            p.arrivalTime <= time && p.burstTime > 0
        );
        availableProcesses.sort((a, b) => a.priority - b.priority);

        if (availableProcesses.length === 0) {
            // Track idle time
            const nextArrival = Math.min(...remainingProcesses
                .filter(p => p.burstTime > 0)
                .map(p => p.arrivalTime));
            
            executionSequence.push({
                pid: 'idle',
                startTime: time,
                endTime: nextArrival
            });

            time = nextArrival;
            continue;
        }

        const currentProcess = availableProcesses[0];
        const burst = currentProcess.burstTime;

        executionSequence.push({
            pid: currentProcess.pid,
            startTime: time,
            endTime: time + burst
        });

        time += burst;
        currentProcess.burstTime = 0;

        const completionTime = time;
        const tat = completionTime - currentProcess.arrivalTime;
        const wt = tat - currentProcess.originalBurstTime;

        metrics.push({
            pid: currentProcess.pid,
            arrivalTime: currentProcess.arrivalTime,
            burstTime: currentProcess.originalBurstTime,
            priority: currentProcess.priority,
            completionTime,
            tat,
            wt
        });

        completed++;
    }

    // Sort metrics by PID to maintain consistent order
    metrics.sort((a, b) => a.pid.localeCompare(b.pid));

    return { metrics, executionSequence };
}











function performSRTFScheduling(processes) {
    const temp = processes.map(p => ({
        ...p,
        remainingTime: p.burstTime,
        completionTime: 0,
        tat: 0,
        wt: 0,
        started: false
    }));

    let currentTime = 0;
    let completed = 0;
    const n = processes.length;
    
    // Store the execution sequence with time intervals
    const executionSequence = [];
    let currentProcess = null;
    let currentProcessStartTime = 0;

    while (completed !== n) {
        let minRemainingTime = Number.MAX_VALUE;
        let selectedProcess = null;

        for (const process of temp) {
            if (process.arrivalTime <= currentTime && 
                process.remainingTime > 0 && 
                process.remainingTime < minRemainingTime) {
                    minRemainingTime = process.remainingTime;
                    selectedProcess = process;
            }
        }

        if (selectedProcess === null) {
            // If there's an idle period, add it to the sequence
            if (currentProcess !== null) {
                executionSequence.push({
                    pid: currentProcess.pid,
                    startTime: currentProcessStartTime,
                    endTime: currentTime
                });
                currentProcess = null;
            }
            currentTime++;
            continue;
        }

        // If there's a process switch, record the previous process's interval
        if (currentProcess !== selectedProcess) {
            if (currentProcess !== null) {
                executionSequence.push({
                    pid: currentProcess.pid,
                    startTime: currentProcessStartTime,
                    endTime: currentTime
                });
            }
            currentProcess = selectedProcess;
            currentProcessStartTime = currentTime;
        }

        selectedProcess.remainingTime--;
        
        if (selectedProcess.remainingTime === 0) {
            completed++;
            selectedProcess.completionTime = currentTime + 1;
            selectedProcess.tat = selectedProcess.completionTime - selectedProcess.arrivalTime;
            selectedProcess.wt = selectedProcess.tat - selectedProcess.burstTime;
            
            // Record the final interval for this process
            executionSequence.push({
                pid: selectedProcess.pid,
                startTime: currentProcessStartTime,
                endTime: currentTime + 1
            });
            currentProcess = null;
        }

        currentTime++;
    }

    const metrics = temp.map(({ pid, arrivalTime, burstTime, completionTime, tat, wt }) => ({
        pid,
        arrivalTime,
        burstTime,
        completionTime,
        tat,
        wt
    }));

    return { metrics, executionSequence };
}




function drawGanttChart(data) {
    const ganttChart = document.getElementById('ganttChart');
    ganttChart.innerHTML = '';
    const chartContainer = document.createElement('div');
    chartContainer.style.display = 'flex';
    chartContainer.style.justifyContent = 'flex-start';
    chartContainer.style.alignItems = 'flex-start';
    chartContainer.style.width = '100%';
    chartContainer.style.border = '1px solid #000';
    chartContainer.style.position = 'relative';

    const colors = [
        '#FFB6C1', '#FFD700', '#90EE90', '#ADD8E6', '#FFDEAD',
        '#DDA0DD', '#FF6347', '#20B2AA', '#FF69B4', '#B0E0E6'
    ];

    const processColors = {};
    let colorIndex = 0;
    const executionSequence = data.executionSequence;
    executionSequence.forEach((interval, index) => {
        const duration = interval.endTime - interval.startTime;
        
        // Assign consistent colors to processes
        if (!processColors[interval.pid]) {
            processColors[interval.pid] = colors[colorIndex++ % colors.length];
        }

        const processDiv = document.createElement('div');
        processDiv.style.backgroundColor = processColors[interval.pid];
        processDiv.style.flex = `${duration}`;
        processDiv.style.height = '50px';
        processDiv.style.position = 'relative';
        processDiv.style.textAlign = 'center';
        processDiv.style.color = 'black';
        processDiv.innerHTML = `
            ${interval.pid}
            <div style="position: absolute; bottom: -10px; left: 0; font-size: 12px;">${interval.startTime}</div>
            <div style="position: absolute; bottom: -10px; right: 0; font-size: 12px;">${interval.endTime}</div>
        `;
        chartContainer.appendChild(processDiv);
    });

    ganttChart.appendChild(chartContainer);
    document.getElementById('ganttChartContainer').style.display = 'block';
}


function renderMetricsTable(metrics) {
    const tableBody = document.querySelector('#metricsTable tbody');
    tableBody.innerHTML = ''; // Clear the table body
    console.log(metrics);
    metrics.forEach(process => {
        tableBody.innerHTML += `
            <tr>
                <td>${process.pid}</td>
                <td>${process.arrivalTime}</td>
                <td>${process.burstTime || process.originalBurstTime}</td> <!-- Use original burst time -->
                <td>${process.priority || '-'}</td>
                <td>${process.completionTime}</td>
                <td>${process.tat}</td>
                <td>${process.wt}</td>
            </tr>`;
    });

    document.getElementById('metricsTable').style.display = 'block'; // Show the table
}


function renderAverages(metrics) {
    const avgTAT = (metrics.reduce((sum, p) => sum + p.tat, 0) / metrics.length).toFixed(2);
    const avgWT = (metrics.reduce((sum, p) => sum + p.wt, 0) / metrics.length).toFixed(2);

    const averagesDiv = document.getElementById('averages');
    averagesDiv.innerHTML = `
        <p>Average Turnaround Time (TAT): ${avgTAT}</p>
        <p>Average Waiting Time (WT): ${avgWT}</p>`;
    averagesDiv.style.display = 'block';
}





