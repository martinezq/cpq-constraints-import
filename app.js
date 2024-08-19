let baseUrl = '';
let ticketName = '';
let username = '';
let password = '';
let selectedFile = null;

const backendGraphQlUrl = `https://cpq-graphql-server.herokuapp.com/promo`;
// const backendGraphQlUrl = `http://localhost:4000/promo`;

document.addEventListener('DOMContentLoaded', () => {
    // Load stored values if they exist
    if (localStorage.getItem('baseUrl')) {
        document.getElementById('base-url').value = localStorage.getItem('baseUrl');
    }
    if (localStorage.getItem('ticketName')) {
        document.getElementById('ticket-name').value = localStorage.getItem('ticketName');
    }
    if (localStorage.getItem('username')) {
        document.getElementById('username').value = localStorage.getItem('username');
    }
});

function login() {
    baseUrl = document.getElementById('base-url').value;
    ticketName = document.getElementById('ticket-name').value;
    username = document.getElementById('username').value;
    password = document.getElementById('password').value;

    // Store values in local storage
    localStorage.setItem('baseUrl', baseUrl);
    localStorage.setItem('ticketName', ticketName);
    localStorage.setItem('username', username);

    document.getElementById('login-form').style.display = 'none';
    document.getElementById('spinner').style.display = 'block';
    document.getElementById('error-message').style.display = 'none';

    fetchConstraints();
}

async function fetchConstraints() {
    const backendUrl = `${backendGraphQlUrl}/${baseUrl.replace(/(^\w+:|^)\/\//, '')}/${ticketName}`;
    
    const query = `
        query {
            listConstraints {
                constraint
                assembly {
                    name
                }
                ruleGroup
            }
        }
    `;

    try {
        const response = await axios.post(backendUrl, {
            query: query
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${btoa(`${username}:${password}`)}`
            }
        });

        if (response.data.errors) {
            throw new Error(response.data.errors.map(error => error.message).join(', '));
        }

        const constraints = response.data.data.listConstraints;
        const tbody = document.querySelector('#constraints-table tbody');
        tbody.innerHTML = '';

        constraints.forEach(item => {
            const row = `<tr>
                <td>${item.constraint}</td>
                <td>${item.assembly.name}</td>
                <td>${item.ruleGroup}</td>
            </tr>`;
            tbody.innerHTML += row;
        });
    } catch (error) {
        console.error('Error fetching constraints:', error);
        displayError('Failed to fetch constraints. ' + error.message);
    } finally {
        document.getElementById('spinner').style.display = 'none';
        document.getElementById('constraints-section').style.display = 'block';
    }
}

function downloadExcel() {
    const table = document.getElementById('constraints-table');
    const workbook = XLSX.utils.table_to_book(table);
    XLSX.writeFile(workbook, 'constraints.xlsx');
}

document.getElementById('file-upload').addEventListener('change', (event) => {
    selectedFile = event.target.files[0];
});

async function uploadExcel() {
    if (!selectedFile) {
        displayError('Please select an Excel file first.');
        return;
    }

    const reader = new FileReader();

    reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);

        const constraints = json.map(row => ({
            constraint: row['Constraint'],
            assembly: { name: row['Assembly Name'] },
            ruleGroup: row['Rule Group']
        }));

        const mutation = `
            mutation {
                upsertConstraints(constraints: ${JSON.stringify(constraints).replace(/"([^"]+)":/g, '$1:')})
            }
        `;

        const backendUrl = `${backendGraphQlUrl}/${baseUrl.replace(/(^\w+:|^)\/\//, '')}/${ticketName}`;

        document.getElementById('spinner').style.display = 'block';
        document.getElementById('constraints-section').style.display = 'none';
        document.getElementById('error-message').style.display = 'none';

        closeUploadModal();

        try {
            const response = await axios.post(backendUrl, {
                query: mutation
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${btoa(`${username}:${password}`)}`
                }
            });

            if (response.data.errors) {
                throw new Error(response.data.errors.map(error => error.message).join(', '));
            }

            await fetchConstraints();
        } catch (error) {
            console.error('Error uploading constraints:', error);
            displayError('Failed to upload constraints. ' + error.message);
        } finally {
            document.getElementById('spinner').style.display = 'none';
            document.getElementById('constraints-section').style.display = 'block';
        }
    };

    reader.readAsArrayBuffer(selectedFile);
}

function showUploadModal() {
    document.getElementById('uploadModal').style.display = 'block';
}

function closeUploadModal() {
    document.getElementById('uploadModal').style.display = 'none';
}

function displayError(message) {
    const errorMessage = document.getElementById('error-message');
    errorMessage.innerText = message;
    errorMessage.style.display = 'block';
}
