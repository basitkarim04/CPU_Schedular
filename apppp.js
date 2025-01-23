
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
                metrics = performSRTFScheduling(processes);
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
// Define the function to perform SRTF scheduling
function performSRTFScheduling(processes) {
    // Create a copy of the processes and sort by arrival time
    const temp = processes.map(p => ({ ...p }));
    temp.sort((p1, p2) => p1.arrivalTime - p2.arrivalTime); // Sort by arrival time

    let currentTime = 0;
    const completed = new Array(temp.length).fill(false);
    let completedCount = 0;

    // Initialize remaining times
    temp.forEach(process => {
        process.remainingTime = process.burstTime; // Assuming remainingTime is a field in Process
    });

    while (completedCount < temp.length) {
        let shortestIndex = -1;
        let shortestRemainingTime = Infinity;

        // Find the process with the shortest remaining time that has arrived
        for (let i = 0; i < temp.length; i++) {
            const process = temp[i];
            if (!completed[i] && process.arrivalTime <= currentTime && process.remainingTime < shortestRemainingTime) {
                shortestRemainingTime = process.remainingTime;
                shortestIndex = i;
            }
        }

        if (shortestIndex === -1) {
            // No process is ready, increment time to the next process arrival
            currentTime++;
        } else {
            // Execute the process with the shortest remaining time
            const process = temp[shortestIndex];
            process.remainingTime--; // Decrement remaining time

            // If the process has completed its execution
            if (process.remainingTime === 0) {
                process.completionTime = currentTime + 1;
                process.tat = process.completionTime - process.arrivalTime;
                process.wt = process.tat - process.burstTime;
                completed[shortestIndex] = true; // Mark process as completed
                completedCount++;
            }
            currentTime++; // Increment time after processing
        }
    }

    return temp; // Return the updated processes with metrics
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

function roundRobin(processes, timeQuantum) {
    const queue = []; // Ready queue
    let currentTime = 0; // Global clock
    let completedProcesses = 0; // Count of completed processes
    const metrics = []; // Store metrics for each process

    // Initialize remaining burst time and visited flag for each process
    processes.forEach((process) => {
        process.remainingBurstTime = process.burstTime;
        process.visited = false;
    });

    // Add processes to the queue based on arrival time and execute them
    while (completedProcesses < processes.length) {
        // Add processes that have arrived by the current global clock to the queue
        for (const process of processes) {
            if (
                process.arrivalTime <= currentTime &&
                !process.visited &&
                !queue.includes(process)
            ) {
                queue.push(process);
                process.visited = true; // Mark process as visited
            }
        }

        if (queue.length === 0) {
            // If the queue is empty, increment the global clock (idle time)
            currentTime++;
            continue;
        }

        // Pick the first process from the queue
        const process = queue.shift();

        // Run the process for min(timeQuantum, remainingBurstTime)
        const timeSpent = Math.min(timeQuantum, process.remainingBurstTime);
        currentTime += timeSpent;
        process.remainingBurstTime -= timeSpent;

        // If the process is finished
        if (process.remainingBurstTime === 0) {
            completedProcesses++;
            process.completionTime = currentTime;
            process.tat = process.completionTime - process.arrivalTime; // Turnaround Time
            process.wt = process.tat - process.burstTime; // Waiting Time
            metrics.push(process); // Save metrics for the process
        } else {
            // If the process is not finished, add it back to the end of the queue
            queue.push(process);
        }
    }

    return metrics;
}


function renderGanttChart(metrics) {
    const ganttChart = document.getElementById('ganttChart');
    ganttChart.innerHTML = ''; // Clear existing Gantt chart

    let currentTime = 0; // Track the current timeline

    // Create a container for the Gantt chart
    const chartContainer = document.createElement('div');
    chartContainer.style.display = 'flex';
    chartContainer.style.justifyContent = 'flex-start'; // Align items to the start
    chartContainer.style.alignItems = 'flex-start'; // Align items to the start
    chartContainer.style.width = '100%'; // Full width
    chartContainer.style.border = '1px solid #000'; // Optional: border for visibility
    chartContainer.style.position = 'relative'; // For absolute positioning of child elements

    // Define a color palette
    const colors = [
        '#FFB6C1', // Light Pink
        '#FFD700', // Gold
        '#90EE90', // Light Green
        '#ADD8E6', // Light Blue
        '#FFDEAD', // Navajo White
        '#DDA0DD', // Plum
        '#FF6347', // Tomato
        '#20B2AA', // Light Sea Green
        '#FF69B4', // Hot Pink
        '#B0E0E6'  // Powder Blue
    ];

    metrics.forEach((process, index) => {
        // Debugging: Log process details
        console.log('Rendering Process:', process);

        // Handle idle time if the current process starts after the last process ended
        if (currentTime < process.arrivalTime) {
            const idleTime = process.arrivalTime - currentTime;
            const idleDiv = document.createElement('div');
            idleDiv.style.backgroundColor = '#ccc'; // Gray for idle time
            idleDiv.style.flex = `${idleTime}`;
            idleDiv.style.height = '50px'; // Set a fixed height for uniformity
            idleDiv.style.position = 'relative';
            idleDiv.style.textAlign = 'center';
            idleDiv.style.color = 'black';
            idleDiv.innerHTML = `
                Idle
                <div style="position: absolute; bottom: -20px; left: 0; font-size: 12px; color: black;">${currentTime}</div>
                <div style="position: absolute; bottom: -20px; right: 0; font-size: 12px; color: black;">${process.arrivalTime}</div>
            `;
            chartContainer.appendChild(idleDiv);
            currentTime = process.arrivalTime; // Move the timeline forward to the process start time
        }

        // Calculate execution time for the current process
        const executionTime = process.completionTime - Math.max(process.arrivalTime, currentTime);

        const processDiv = document.createElement('div');
        processDiv.style.backgroundColor = colors[index % colors.length]; // Use colors from the palette
        processDiv.style.flex = `${executionTime}`;
        processDiv.style.height = '50px'; // Set a fixed height for uniformity
        processDiv.style.position = 'relative';
        processDiv.style.textAlign = 'center';
        processDiv.style.color = 'black'; // Change text color to black for better contrast
        processDiv.innerHTML = `
                ${process.pid}
            <div style="position: absolute; bottom: -10px; left: 0; font-size: 12px;">${currentTime}</div>
            <div style="position: absolute; bottom: -10px; right: 0; font-size: 12px;">${currentTime + executionTime}</div>
        `;
        chartContainer.appendChild(processDiv);
        currentTime += executionTime; // Update the timeline to the end of the current process
    });

    ganttChart.appendChild(chartContainer); // Append the chart container to the Gantt chart element

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