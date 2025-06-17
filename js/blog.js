document.addEventListener("DOMContentLoaded", function () {
    // Set footer year safely after DOM loads
    const yearSpan = document.getElementById("current-year");
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    // Add fade-in to article cards
    const cards = document.querySelectorAll('.article-card');
    cards.forEach((card, index) => {
        card.style.animationDelay = `${index * 100}ms`;
        card.classList.add('fade-in');
    });
});
