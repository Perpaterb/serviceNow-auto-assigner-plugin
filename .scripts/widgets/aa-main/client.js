api.controller = function($scope) {
    var c = this;
    c.activeTab = 0;

    c.toggleRunning = function(assigner) {
        c.server.update({
            action: 'toggleRunning',
            assignerSysId: assigner.sys_id
        }).then(function() {
            assigner.running = !assigner.running;
        });
    };
};
