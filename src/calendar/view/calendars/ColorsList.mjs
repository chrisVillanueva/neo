import List from '../../../list/Base.mjs';

/**
 * @class Neo.calendar.view.calendars.ColorsList
 * @extends Neo.list.Base
 */
class ColorsList extends List {
    static getConfig() {return {
        /**
         * @member {String} className='Neo.calendar.view.calendars.ColorsList'
         * @protected
         */
        className: 'Neo.calendar.view.calendars.ColorsList',
        /**
         * @member {String} ntype='calendar-colors-list'
         * @protected
         */
        ntype: 'calendar-colors-list',
        /**
         * @member {Object} bind
         */
        bind: {
            store: 'stores.colors'
        },
        /**
         * @member {String[]} cls=['neo-calendars-colors-list','neo-list']
         */
        cls: ['neo-calendars-colors-list', 'neo-list']
    }}

    /**
     * Override this method for custom renderers
     * @param {Object} record
     * @param {Number} index
     * @returns {Object|Object[]|String} Either a config object to assign to the item, a vdom cn array or a html string
     */
    createItemContent(record, index) {
        return {style: {
            backgroundColor: `var(--event-${record.name}-color)`,
            color          : `var(--event-${record.name}-color)` // needed for the box-shadow (CSS currentColor)
        }};
    }

    /**
     * Gets triggered from selection.Model: select()
     * @param {String[]} items
     */
    onSelect(items) {
        let me       = this,
            recordId = me.getItemRecordId(items[0]);

        me.fire('change', {
            record: me.store.get(recordId)
        });
    }
}

Neo.applyClassConfig(ColorsList);

export {ColorsList as default};