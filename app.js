
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
            alert(`Invalid input for Process P${i + 1}. Please ensure all fields are filled correctly.`);
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

    let metrics;
    switch (algorithm) {
        case 'fcfs':
            metrics = fcfs(processes);
            break;
        case 'sjf':
            metrics = sjf(processes, false);
            break;
        case 'srtf':
            metrics = srtf(processes);
            break;
        case 'rr':
            const quantum = parseInt(prompt('Enter Time Quantum:', '2'));
            if (isNaN(quantum) || quantum <= 0) {
                alert('Invalid quantum. Please enter a positive number.');
                return;
            }
            metrics = roundRobin(processes, quantum);
            break;
        case 'priority_np':
            metrics = priorityScheduling(processes, false);
            break;
        case 'priority_p':
            metrics = priorityScheduling(processes, true);
            break;
    }
    renderMetricsTable(metrics);
    renderAverages(metrics);
    renderGanttChart(metrics);
});

function fcfs(processes) { 
    // Sort processes by arrival time
    processes.sort((a, b) => a.arrivalTime - b.arrivalTime);

    let time = 0; // Initialize time at 0
    return processes.map(process => {
        // Set completionTime to the current time plus burstTime
        const completionTime = time + process.burstTime;

        // Calculate TAT and WT based on updated completionTime
        const tat = completionTime - process.arrivalTime;
        const wt = tat - process.burstTime;

        // Increment time by burstTime to update for the next process
        time += process.burstTime;

        return { ...process, completionTime, tat, wt };
    });
}

function sjf(processes, preemptive) {
    let time = 0, completed = 0;
    const metrics = [];
    const remainingProcesses = processes.map(p => ({ ...p }));

    while (completed < processes.length) {
        const availableProcesses = remainingProcesses.filter(p => p.arrivalTime <= time && p.burstTime > 0);
        availableProcesses.sort((a, b) => a.burstTime - b.burstTime);

        if (availableProcesses.length === 0) {
            time++;
            continue;
        }

        const currentProcess = preemptive ? availableProcesses[0] : availableProcesses.shift();
        const burst = preemptive ? 1 : currentProcess.burstTime;

        currentProcess.burstTime -= burst;
        time += burst;

        if (currentProcess.burstTime === 0) {
            const completionTime = time;
            const tat = completionTime - currentProcess.arrivalTime;
            const wt = tat - processes.find(p => p.pid === currentProcess.pid).originalBurstTime;

            metrics.push({
                ...currentProcess,
                originalBurstTime: processes.find(p => p.pid === currentProcess.pid).originalBurstTime, // Add original burst time
                completionTime,
                tat,
                wt
            });
            completed++;
        }
    }

    return metrics;
}

function srtf(processes) {
    let time = 0; // The current time
    let completed = 0; // Count of completed processes
    const metrics = []; // Stores the metrics (completion time, turnaround time, etc.)
    const remainingProcesses = processes.map(p => ({ ...p, remainingBurstTime: p.burstTime }));

    while (completed < processes.length) {
        const availableProcesses = remainingProcesses.filter(p => p.arrivalTime <= time && p.remainingBurstTime > 0);

        if (availableProcesses.length === 0) {
            time++;
            continue;
        }

        // Select the process with the shortest remaining burst time
        const currentProcess = availableProcesses.sort((a, b) => a.remainingBurstTime - b.remainingBurstTime)[0];
        const burst = 1; // We can reduce the burst by 1 in each iteration

        // Reduce the remaining burst time of the current process
        currentProcess.remainingBurstTime -= burst;
        time += burst;

        // If the process is finished
        if (currentProcess.remainingBurstTime === 0) {
            const completionTime = time;
            const tat = completionTime - currentProcess.arrivalTime;
            const wt = tat - currentProcess.burstTime;

            metrics.push({
                ...currentProcess,
                completionTime,
                tat,
                wt
            });
            completed++;
        }
    }

    return metrics;
}


function roundRobin(processes, quantum) {
    const queue = processes.map(p => ({ ...p }));
    const metrics = [];
    let time = 0;

    while (queue.length > 0) {
        const process = queue.shift();
        const burst = Math.min(process.burstTime, quantum);

        time += burst;
        process.burstTime -= burst;

        if (process.burstTime > 0) {
            queue.push(process);
        } else {
            const completionTime = time;
            const tat = completionTime - process.arrivalTime;
            const wt = tat - processes.find(p => p.pid === process.pid).originalBurstTime;

            metrics.push({ ...process, completionTime, tat, wt });
        }
    }

    return metrics;
}

function priorityScheduling(processes, preemptive) {
    let time = 0, completed = 0;
    const metrics = [];
    const remainingProcesses = processes.map(p => ({ ...p }));

    while (completed < processes.length) {
        const availableProcesses = remainingProcesses.filter(p => p.arrivalTime <= time && p.burstTime > 0);
        availableProcesses.sort((a, b) => a.priority - b.priority);

        if (availableProcesses.length === 0) {
            time++;
            continue;
        }

        const currentProcess = preemptive ? availableProcesses[0] : availableProcesses.shift();
        const burst = preemptive ? 1 : currentProcess.burstTime;

        currentProcess.burstTime -= burst;
        time += burst;

        if (currentProcess.burstTime === 0) {
            const completionTime = time;
            const tat = completionTime - currentProcess.arrivalTime;
            const wt = tat - processes.find(p => p.pid === currentProcess.pid).burstTime;

            metrics.push({ ...currentProcess, completionTime, tat, wt });
            completed++;
        }
    }

    return metrics;
}

function renderGanttChart(metrics) {
    const ganttChart = document.getElementById('ganttChart');
    ganttChart.innerHTML = ''; // Clear existing Gantt chart

    let currentTime = 0; // Track the current timeline

    metrics.forEach((process, index) => {
        // Handle idle time if the current process starts after the last process ended
        if (currentTime < process.arrivalTime) {
            ganttChart.innerHTML += `
                <div style="background-color: #ccc; flex: ${process.arrivalTime - currentTime}; position: relative; text-align: center; color: black;">
                    Idle
                    <div style="position: absolute; bottom: -20px; left: 0; font-size: 12px; color: black;">${currentTime}</div>
                    <div style="position: absolute; bottom: -20px; right: 0; font-size: 12px; color: black;">${process.arrivalTime}</div>
                </div>`;
            currentTime = process.arrivalTime; // Move the timeline forward to the process start time
        }

        // Calculate execution time for the current process
        const executionTime = process.completionTime - Math.max(process.arrivalTime, currentTime);

        ganttChart.innerHTML += `
            <div style="background-color: #${Math.floor(Math.random() * 16777215).toString(16)}; flex: ${executionTime}; position: relative; text-align: center; color: white;">
                ${process.pid}
                <div style="position: absolute; bottom: -20px; left: 0; font-size: 12px;">${currentTime}</div>
                <div style="position: absolute; bottom: -20px; right: 0; font-size: 12px;">${currentTime + executionTime}</div>
            </div>`;
        currentTime += executionTime; // Update the timeline to the end of the current process
    });

    // Show the Gantt chart container
    document.getElementById('ganttChartContainer').style.display = 'block';
}




function renderMetricsTable(metrics) {
    const tableBody = document.querySelector('#metricsTable tbody');
    tableBody.innerHTML = ''; // Clear the table body

    metrics.forEach(process => {
        tableBody.innerHTML += `
            <tr>
                <td>${process.pid}</td>
                <td>${process.arrivalTime}</td>
                <td>${process.originalBurstTime}</td> <!-- Use originalBurstTime instead of burstTime -->
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





