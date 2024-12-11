function validateForm() {
    var isValid = true;

    // Get form elements by ID
    const regd_no = document.getElementById('regd_no').value;
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const branch = document.getElementById('branch').value;
    const agree = document.getElementById('agree').checked;
    const gender = document.querySelector('input[name="gender"]:checked');
    const bank_account = document.querySelector('input[name="bank_account"]:checked');

    // Check if all required fields are filled
    if (!regd_no || !name || !email || !branch || !agree || !gender || !bank_account) {
        isValid = false;
    }

    // Get the message div
    const message = document.getElementById('message');

    if (isValid) {
        message.textContent = "Form is Submitted Successfully!";
        message.style.color = "green";
    } else {
        message.textContent = "Form is Not Submitted! Please fill it accurately.";
        message.style.color = "red";
    }

    // Show the message
    message.style.display = "block";

    // Return false to prevent form submission for demo purposes
    return false;
}





document.addEventListener("DOMContentLoaded", function () {
    const toggleButton = document.getElementById("agree");

    toggleButton.addEventListener("change", function () {
        if (toggleButton.checked) {
            console.log("Toggle is ON. User agrees to the terms.");
        } else {
            console.log("Toggle is OFF. User disagrees with the terms.");
        }
    });

    // Show/hide account or wallet info based on selection
    document.getElementById("yes").addEventListener("change", function () {
        document.getElementById("account-info").style.display = "block";
        document.getElementById("wallet-info").style.display = "none";
    });

    document.getElementById("no").addEventListener("change", function () {
        document.getElementById("wallet-info").style.display = "block";
        document.getElementById("account-info").style.display = "none";
    });
});
