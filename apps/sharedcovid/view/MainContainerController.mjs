import {default as ComponentController} from '../../../src/controller/Component.mjs';
import NeoArray                         from '../../../src/util/Array.mjs';
import Util                             from '../Util.mjs';

/**
 * @class Covid.view.MainContainerController
 * @extends Neo.controller.Component
 */
class MainContainerController extends ComponentController {
    static getStaticConfig() {return {
        /**
         * A regex to replace blank chars
         * @member {RegExp} flagRegEx=/ /gi
         * @private
         * @static
         */
        flagRegEx: / /gi
    }}

    static getConfig() {return {
        /**
         * @member {String} className='Covid.view.MainContainerController'
         * @private
         */
        className: 'Covid.view.MainContainerController',
        /**
         * @member {String} ntype='maincontainer-controller'
         * @private
         */
        ntype: 'maincontainer-controller',
        /**
         * @member {Number} activeMainTabIndex=0
         */
        activeMainTabIndex: 0,
        /**
         * @member {String} apiUrl='https://corona.lmao.ninja/v2/countries'
         */
        apiUrl: 'https://corona.lmao.ninja/v2/countries',
        /**
         * @member {String} apiSummaryUrl='https://corona.lmao.ninja/v2/all'
         */
        apiSummaryUrl: 'https://corona.lmao.ninja/v2/all',
        /**
         * @member {String[]} connectedApps=[]
         */
        connectedApps: [],
        /**
         * @member {Object|null} countryRecord=null
         */
        countryRecord: null,
        /**
         * @member {Object[]|null} data=null
         */
        data: null,
        /**
         * Internal flag to prevent non main windows from triggering their initial route as a change
         * @member {Boolean} firstHashChange=true
         */
        firstHashChange: true,
        /**
         * @member {String[]} mainTabs=['table', 'mapboxglmap', 'worldmap', 'gallery', 'helix', 'attribution']
         * @private
         */
        mainTabs: ['table','mapboxglmap', 'worldmap', 'gallery', 'helix', 'attribution'],
        /**
         * Flag to only load the map once onHashChange, but always on reload button click
         * @member {Boolean} mapboxglMapHasData=false
         * @private
         */
        mapboxglMapHasData: false,
        /**
         * @member {Object} summaryData=null
         */
        summaryData: null,
        /**
         * Flag to only load the map once onHashChange, but always on reload button click
         * @member {Boolean} worldMapHasData=false
         * @private
         */
        worldMapHasData: false,
        /**
         * @member {Object} windowChart=null
         */
        windowChart: null,
    }}

    /**
     *
     */
    onConstructed() {
        super.onConstructed();

        const me = this;

        me.loadData();
        me.loadSummaryData();

        me.view.on({
            connect   : me.onAppConnect,
            disconnect: me.onAppDisconnect,
            mounted   : me.onMainViewMounted,
            scope     : me
        });

        setTimeout(() => {
            Object.assign(me, {
                helixView : me.getReference('helix'),
                mapBoxView: me.getReference('mapboxglmap'),
                tableView : me.getReference('table')
            });
        }, 1);
    }

    /**
     *
     * @param {Object[]} data
     */
    addStoreItems(data) {
        const me           = this,
              countryStore = me.getReference('country-field').store,
              reference    = me.mainTabs[me.activeMainTabIndex],
              activeTab    = me.getReference(reference);

        // worldometer added world as a country
        // might get removed by the NovelCovid API
        if (data[0] && data[0].country === 'World') {
            const worldData = data.shift();
        }

        data.forEach(item => {
            if (item.country.includes('"')) {
                item.country = item.country.replace('"', "\'");
            }

            item.casesPerOneMillion = item.casesPerOneMillion > item.cases ? 'N/A' : item.casesPerOneMillion || 0;
            item.infected           = item.casesPerOneMillion;
        });

        me.data = data;

        if (countryStore.getCount() < 1) {
            me.getReference('country-field').store.data = data;
        }

        if (['gallery', 'helix', 'table'].includes(reference)) {
            activeTab.store.data = data;
        }

        else if (reference === 'mapboxglmap') {
            me.getReference('mapboxglmap').data = data;
            me.mapboxglMapHasData = true;
        }

        else if (reference === 'worldmap') {
            activeTab.loadData(data);
            me.worldMapHasData = true;
        }
    }

    /**
     *
     * @param {Object} data
     * @param {Number} data.active
     * @param {Number} data.cases
     * @param {Number} data.deaths
     * @param {Number} data.recovered
     * @param {Number} data.updated // timestamp
     */
    applySummaryData(data) {
        let me        = this,
            container = me.getReference('total-stats'),
            vdom      = container.vdom;

        me.summaryData = data;

        vdom.cn[0].cn[1].html = Util.formatNumber({value: data.cases});
        vdom.cn[1].cn[1].html = Util.formatNumber({value: data.active});
        vdom.cn[2].cn[1].html = Util.formatNumber({value: data.recovered});
        vdom.cn[3].cn[1].html = Util.formatNumber({value: data.deaths});

        container.vdom = vdom;

        container = me.getReference('last-update');
        vdom      = container.vdom;

        vdom.html = 'Last Update: ' + new Intl.DateTimeFormat('default', {
            hour  : 'numeric',
            minute: 'numeric',
            second: 'numeric'
        }).format(new Date(data.updated));

        container.vdom = vdom;
    }

    /**
     *
     * @param {Object} record
     */
    clearCountryField(record) {
        this.getReference('country-field').clear();
    }

    /**
     * @param {String} containerReference
     * @param {String} url
     * @param {String} windowName
     */
    createPopupWindow(containerReference, url, windowName) {
        let me = this;

        Neo.Main.getWindowData().then(winData => {
            Neo.main.DomAccess.getBoundingClientRect({
                id: [me.getReference(containerReference).id]
            }).then(data => {
                let {height, left, top, width} = data[0];

                height -= 50; // popup header in Chrome
                left   += winData.screenLeft;
                top    += (winData.outerHeight - winData.innerHeight + winData.screenTop);

                Neo.Main.windowOpen({
                    url           : `../${url}/index.html`,
                    windowFeatures: `height=${height},left=${left},top=${top},width=${width}`,
                    windowName    : windowName
                });
            });
        });
    }

    /**
     *
     * @param {String} name
     * @return {String} url
     */
    getCountryFlagUrl(name) {
        const map = {
            'bosnia'                               : 'bosnia-and-herzegovina',
            'cabo-verde'                           : 'cape-verde',
            'car'                                  : 'central-african-republic',
            'caribbean-netherlands'                : 'netherlands',
            'channel-islands'                      : 'jersey',
            'côte-d\'ivoire'                       : 'ivory-coast',
            'congo'                                : 'republic-of-the-congo',
            'congo,-the-democratic-republic-of-the': 'democratic-republic-of-congo',
            'curaçao'                              : 'curacao',
            'czechia'                              : 'czech-republic',
            'diamond-princess'                     : 'japan', // cruise ship
            'drc'                                  : 'democratic-republic-of-congo',
            'el-salvador'                          : 'salvador',
            'eswatini'                             : 'swaziland',
            'faeroe-islands'                       : 'faroe-islands',
            'falkland-islands-(malvinas)'          : 'falkland-islands',
            'french-guiana'                        : 'france', // ?
            'guadeloupe'                           : 'france', // ?
            'holy-see-(vatican-city-state)'        : 'vatican-city',
            'iran,-islamic-republic-of'            : 'iran',
            'lao-people\'s-democratic-republic'    : 'laos',
            'libyan-arab-jamahiriya'               : 'libya',
            'macedonia'                            : 'republic-of-macedonia',
            'mayotte'                              : 'france', // ?
            'moldova,-republic-of'                 : 'moldova',
            'ms-zaandam'                           : 'netherlands', // cruise ship
            'new-caledonia'                        : 'france',
            'palestinian-territory,-occupied'      : 'palestine',
            'poland'                               : 'republic-of-poland',
            'réunion'                              : 'france',
            's.-korea'                             : 'south-korea',
            'st.-barth'                            : 'st-barts',
            'saint-lucia'                          : 'st-lucia',
            'saint-martin'                         : 'sint-maarten',
            'saint-pierre-miquelon'                : 'france',
            'saint-vincent-and-the-grenadines'     : 'st-vincent-and-the-grenadines',
            'syrian-arab-republic'                 : 'syria',
            'tanzania,-united-republic-of'         : 'tanzania',
            'timor-leste'                          : 'east-timor',
            'turks-and-caicos-islands'             : 'turks-and-caicos',
            'u.s.-virgin-islands'                  : 'virgin-islands',
            'uae'                                  : 'united-arab-emirates',
            'uk'                                   : 'united-kingdom',
            'usa'                                  : 'united-states-of-america',
            'uzbekistan'                           : 'uzbekistn',
            'venezuela,-bolivarian-republic-of'    : 'venezuela',
            'viet-nam'                             : 'vietnam'
        };

        let imageName = name.toLowerCase().replace(MainContainerController.flagRegEx, '-');

        imageName = map[imageName] || imageName;

        if (Neo.config.isGitHubPages) {
            let path = '../../../../resources/images/flaticon/country_flags/png/' + imageName + '.png';

            if (!Neo.config.isExperimental) {
                path = '../../' + path;
            }

            return path;
        }

        return 'https://raw.githubusercontent.com/neomjs/pages/master/resources/images/flaticon/country_flags/png/' + imageName + '.png';
    }

    /**
     *
     * @param {String} [appName]
     * @returns {Neo.component.Base}
     */
    getMainView(appName) {
        if (!appName || appName === 'Covid') {
            return this.view;
        }

        return Neo.apps[appName].mainViewInstance;
    }

    /**
     *
     * @param {Object} hashObject
     * @param {String} hashObject.mainview
     * @return {Number}
     */
    getTabIndex(hashObject) {
        if (!hashObject || !hashObject.mainview) {
            return 0;
        }

        return this.mainTabs.indexOf(hashObject.mainview);
    }

    /**
     *
     * @param {Number} tabIndex
     * @return {Neo.component.Base}
     */
    getView(tabIndex) {
        return this.getReference(this.mainTabs[tabIndex]);
    }

    /**
     *
     */
    loadData() {
        const me = this;

        fetch(me.apiUrl)
            .then(response => response.json())
            .then(data => me.addStoreItems(data))
            .catch(err => console.log('Can’t access ' + me.apiUrl, err));
    }

    /**
     *
     */
    loadSummaryData() {
        const me = this;

        fetch(me.apiSummaryUrl)
            .then(response => response.json())
            .then(data => me.applySummaryData(data))
            .catch(err => console.log('Can’t access ' + me.apiSummaryUrl, err));

        setTimeout(() => {
            if (!me.summaryData) {
                me.onLoadSummaryDataFail();
            }
        }, 2000);
    }

    /**
     *
     * @param {String} name
     */
    onAppConnect(name) {
        console.log('onAppConnect', name);

        let me = this,
            parentView, view;

        switch (name) {
            case 'Covid2':
                view = me.getReference('controls-panel');
                parentView = Neo.getComponent(view.parentId);
                parentView.storeReferences();
                break;
            case 'Covid3':
                view = me.getReference('helix-container');
                NeoArray.remove(me.mainTabs, 'helix');
                me.activeMainTabIndex--;
                Neo.Main.editRoute({mainview: me.mainTabs[me.activeMainTabIndex]});
                break;
            case 'Covid4':
                view = me.getReference('mapbox-gl-container');
                NeoArray.remove(me.mainTabs, 'mapboxglmap');
                me.activeMainTabIndex--;
                Neo.Main.editRoute({mainview: me.mainTabs[me.activeMainTabIndex]});
                break;
        }

        if (view) {
            NeoArray.add(me.connectedApps, name);

            parentView = parentView ? parentView : view.isTab ? view.up('tab-container') : Neo.getComponent(view.parentId);
            parentView.remove(view, false);

            Neo.apps[name].on('render', () => {
                setTimeout(() => {
                    me.getMainView(name).add(view);
                }, 100);
            });

        }
    }

    /**
     *
     * @param {String} name
     */
    onAppDisconnect(name) {
        let me         = this,
            parentView = me.getMainView(name),
            view       = parentView.items[0],
            index;

        console.log('onAppDisconnect', name);

        switch (name) {
            case 'Covid':
                Neo.Main.windowClose({
                    names: me.connectedApps,
                });
                break;
            case 'Covid2':
            case 'Covid3':
            case 'Covid4':
                view = parentView.items[0];
                break;
        }

        if (view) {
            NeoArray.remove(me.connectedApps, name);

            parentView.remove(view, false);

            switch (name) {
                case 'Covid2':
                    me.getReference('table-container').add(view);
                    break;
                case 'Covid3':
                    index = me.connectedApps.includes('Covid4') ? 4 : 3;
                    me.getReference('tab-container').insert(index, view);
                    me.mainTabs.splice(index, 0, 'helix');
                    break;
                case 'Covid4':
                    me.getReference('tab-container').insert(1, view);
                    me.mainTabs.splice(1, 0, 'mapboxglmap');
                    break;
            }
        }
    }

    /**
     *
     */
    onCountryFieldClear() {
        this.countryRecord = null;

        Neo.Main.editRoute({
            country: null
        });
    }

    /**
     *
     * @param {Object} data
     */
    onCountryFieldSelect(data) {console.log('onCountryFieldSelect', data);
        this.countryRecord = data.record;

        Neo.Main.editRoute({
            country: data.value
        });
    }

    /**
     *
     * @param {Object} value
     * @param {Object} oldValue
     */
    onHashChange(value, oldValue) {
        let me                = this,
            activeIndex       = me.getTabIndex(value.hash),
            country           = value.hash && value.hash.country,
            countryField      = me.getReference('country-field'),
            tabContainer      = me.getReference('tab-container'),
            activeView        = me.getView(activeIndex),
            delaySelection    = !me.data ? 1000 : tabContainer.activeIndex !== activeIndex ? 100 : 0,
            id, selectionModel;

        if (me.firstHashChange || value.appName) {console.log('onHashChange', value);
            selectionModel = activeView.selectionModel;

            tabContainer.activeIndex = activeIndex;
            me.activeMainTabIndex    = activeIndex;

            if (activeView.ntype === 'helix') {
                activeView.getOffsetValues();
            }

            // todo: this will only load each store once. adjust the logic in case we want to support reloading the API

            if (me.data && activeView.store && activeView.store.getCount() < 1) {
                activeView.store.data = me.data;
                delaySelection = 500;
            }

            // todo: https://github.com/neomjs/neo/issues/483
            // quick hack. selectionModels update the vdom of the table.Container.
            // if table.View is vdom updating, this can result in a 2x rendering of all rows.
            if (delaySelection === 1000 && activeView.ntype === 'table-container') {
                delaySelection = 2000;
            }

            if (activeView.ntype === 'covid-world-map' && me.data) {
                if (!me.worldMapHasData) {
                    activeView.loadData(me.data);
                    me.worldMapHasData = true;
                }
            }

            // todo: instead of a timeout this should add a store load listener (single: true)
            setTimeout(() => {
                if (me.data) {
                    if (country) {
                        countryField.value = country;
                    } else {
                        value.country = 'all';
                    }

                    if (activeView.ntype === 'gallery') {
                        if (!selectionModel.isSelected(country)) {
                            selectionModel.select(country, false);
                        }
                    }

                    if (activeView.ntype === 'helix' || me.connectedApps.includes('Covid3')) {
                        if (!me.helixView.selectionModel.isSelected(country)) {
                            me.helixView.selectionModel.select(country, false);
                            me.helixView.onKeyDownSpace(null);
                        }
                    }

                    if ((activeView.ntype === 'mapboxgl' || me.connectedApps.includes('Covid4')) && me.data) {
                        if (!me.mapboxglMapHasData) {
                            me.mapBoxView.data = me.data;
                            me.mapboxglMapHasData = true;
                        }

                        if (me.countryRecord) {
                            MainContainerController.selectMapboxGlCountry(me.mapBoxView, me.tableView.store.get(country));
                        }

                        me.mapBoxView.autoResize();
                    }

                    if (activeView.ntype === 'table-container') {
                        id = selectionModel.getRowId(activeView.store.indexOf(country));

                        me.getReference('table-container').fire('countrySelect', {record: activeView.store.get(country)});

                        if (!selectionModel.isSelected(id)) {
                            selectionModel.select(id);
                            Neo.main.DomAccess.scrollToTableRow({id: id});
                        }
                    }
                }
            }, delaySelection);
        }

        me.firstHashChange = false;
    }

    /**
     *
     */
    onLoadSummaryDataFail() {
        const table = this.getReference('table'),
              vdom = table.vdom;

        vdom.cn[0].cn[1].cn.push({
            tag  : 'div',
            cls  : ['neo-box-label', 'neo-label'],
            html : [
                'Summary data did not arrive after 2s.</br>',
                'Please double-check if the API is offline:</br></br>',
                '<a target="_blank" href="https://corona.lmao.ninja/all">NovelCOVID/API all endpoint</a></br></br>',
                'and if so please try again later.'
            ].join(''),
            style: {
                margin: '20px'
            }
        });

        table.vdom = vdom;
    }

    /**
     *
     */
    onMainViewMounted() {
        const me = this;

        Neo.main.DomAccess.addScript({
            async: true,
            defer: true,
            src  : 'https://buttons.github.io/buttons.js'
        });

        me.getReference('gallery').on('select', me.updateCountryField, me);
        me.getReference('helix')  .on('select', me.updateCountryField, me);

        me.getReference('table').on({
            deselect: me.clearCountryField,
            select  : me.updateCountryField,
            scope   : me
        });
    }

    /**
     * @param {Object} data
     */
    onReloadDataButtonClick(data) {
        const me = this;

        me.loadData();
        me.loadSummaryData();
    }

    /**
     * @param {Object} data
     */
    onRemoveFooterButtonClick(data) {
        const me        = this,
              activeTab = me.getReference('tab-container').getActiveCard();

        me.view.remove(me.getReference('footer'), true);

        if (activeTab.ntype === 'covid-mapboxgl-container') {
            me.getReference('mapboxglmap').autoResize();
        }
    }

    /**
     * @param {Object} data
     */
    onSwitchThemeButtonClick(data) {
        let me       = this,
            button   = data.component,
            logo     = me.getReference('logo'),
            logoPath = 'https://raw.githubusercontent.com/neomjs/pages/master/resources/images/apps/covid/',
            vdom     = logo.vdom,
            view     = me.view,
            buttonText, cls, href, iconCls, mapView, mapViewStyle, theme;

        if (me.connectedApps.includes('Covid4')) {
            mapView = me.getMainView('Covid4').items[0].items[0];
        } else {
            mapView = me.getReference('mapboxglmap');
        }

        if (button.text === 'Theme Light') {
            buttonText   = 'Theme Dark';
            href         = '../dist/development/neo-theme-light-no-css4.css';
            iconCls      = 'fa fa-moon';
            mapViewStyle = mapView.mapboxStyleLight;
            theme        = 'neo-theme-light';
        } else {
            buttonText   = 'Theme Light';
            href         = '../dist/development/neo-theme-dark-no-css4.css';
            iconCls      = 'fa fa-sun';
            mapViewStyle = mapView.mapboxStyleDark;
            theme        = 'neo-theme-dark';
        }

        vdom.src = logoPath + (theme === 'neo-theme-dark' ? 'covid_logo_dark.jpg' : 'covid_logo_light.jpg');
        logo.vdom = vdom;


        if (Neo.config.useCss4) {
            [view.appName, ...me.connectedApps].forEach(appName => {
                view = me.getMainView(appName);

                cls = [...view.cls];

                view.cls.forEach(item => {
                    if (item.includes('neo-theme')) {
                        NeoArray.remove(cls, item);
                    }
                });

                NeoArray.add(cls, theme);
                view.cls = cls;
            });

            button.set({
                iconCls: iconCls,
                text   : buttonText
            });
        } else {
            [view.appName, ...me.connectedApps].forEach(appName => {
                Neo.main.addon.Stylesheet.swapStyleSheet({
                    appName: appName,
                    href   : href,
                    id     : 'neo-theme'
                });
            });
        }

        button.set({
            iconCls: iconCls,
            text   : buttonText
        });

        mapView.mapboxStyle = mapViewStyle;
    }

    /**
     * @param {Object} data
     */
    onWindowChartMaximizeButtonClick(data) {
        this.createPopupWindow('controls-panel', 'sharedcovid_chart', 'Covid2');
    }

    /**
     * @param {Object} data
     */
    onWindowHelixMaximizeButtonClick(data) {
        this.createPopupWindow('helix-container', 'sharedcovid_helix', 'Covid3');
    }

    /**
     * @param {Object} data
     */
    onWindowMapMaximizeButtonClick(data) {
        this.createPopupWindow('mapbox-gl-container', 'sharedcovid_map', 'Covid4');
    }

    /**
     *
     * @param view
     * @param record
     */
    static selectMapboxGlCountry(view, record) {console.log(record.countryInfo.iso2);
        // https://github.com/neomjs/neo/issues/490
        // there are missing iso2&3 values on natural earth vector
        const map = {
            FRA    : ['match', ['get', 'NAME'], ['France'], true, false],
            NOR    : ['match', ['get', 'NAME'], ['Norway'], true, false],
            default: ['match', ['get', 'ISO_A3'], [record.countryInfo.iso3], true, false]
        };

        view.setFilter({
            layerId: 'ne-10m-admin-0-countries-4s7rvf',
            value  : map[record.countryInfo.iso3] || map['default']
        });
        
        view.flyTo({
            lat: record.countryInfo.lat,
            lng: record.countryInfo.long
        });

        view.zoom = 5; // todo: we could use a different value for big countries (Russia, USA,...)
    }

    /**
     *
     * @param {Object} data
     * @param {Object} data.record
     */
    updateCountryField(data) {
        Neo.Main.editRoute({
            country: data.record.country
        });
    }
}

Neo.applyClassConfig(MainContainerController);

export {MainContainerController as default};