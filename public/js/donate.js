var input = document.querySelector('input');
input.addEventListener('input', resizeInput);
resizeInput.call(input);

function resizeInput() {
  if (this.value > 5) {
    this.value = 5;
  }
  if (this.value.length >= 1) {
    this.style.width = this.value.length + 0.5 + 'ch';
  }
}

$(document).ready(function () {
  $('.sidenav').sidenav();
});
