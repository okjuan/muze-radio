var sliders = document.getElementsByClassName('slider');
for (var i = 0; i < sliders.length; i++) {
sliders[i].oninput = function() {
    document.getElementById(this.id + '-value').textContent = this.value;
    console.log(this.id + ' value: ' + this.value);
}
// Trigger the event manually to display the initial value
sliders[i].oninput();
}