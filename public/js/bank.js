$('input').on('keyup', function () {
  this.value = this.value.toUpperCase();
});

const toggleIcons = ['search', 'delete'];
let toggleIndex = 1;

$(document).ready(function () {
  const params = new URL(window.location.href).searchParams;

  // Set blood group <select>, city <input>, and rh radio
  params.forEach((value, key) => {
    if (key === 'rh') {
      // Set the rh radio button
      $(`input[name="rh"][value="${value}"]`).prop('checked', true);
    } else {
      const $field = $(`[name="${key}"]`);
      if ($field.length > 0) {
        $field.val(value);

        // If it's a <select>, re-init Materialize
        if ($field.is('select')) {
          $field.formSelect();
        }
      }
    }
  });

  // Toggle search form
  $('#hider').click(function () {
    $('#searcher').toggle(400);
    $(this).html('<i class="material-icons">' + toggleIcons[toggleIndex++ % 2] + '</i>');
  });

  // Initialize Materialize sidenav and select
  $('.sidenav').sidenav();
  $('select').formSelect();
});
