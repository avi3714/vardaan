$('input').on('keyup', function () {
  this.value = this.value.toUpperCase();
});

var toggleIcons = ['search', 'delete'];
var toggleIndex = 1;

$(document).ready(function () {
  new URL(window.location.href).searchParams.forEach((value, key) => {
    if (key !== 'rh') {
      document.getElementsByName(key).forEach((input) => {
        input.value = value;
      });
    }
  });

  $('#hider').click(function () {
    $('#searcher').toggle(400);
    $(this).html('<i class="material-icons">' + toggleIcons[toggleIndex++ % 2] + '</i>');
  });

  $('.sidenav').sidenav();
});
